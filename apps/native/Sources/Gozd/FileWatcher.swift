import Darwin
import Dispatch
import Foundation

/// ワークスペースのファイル監視を管理する
///
/// 監視対象:
/// - ワークスペース全体（FSEvents, recursive） → fsChange イベント
/// - git 関連ファイル（DispatchSource） → gitStatusChange / branchChange
///
/// 世代管理で非同期初期化中の race condition を防止する。
final class FileWatcher: @unchecked Sendable {
    struct Callbacks: Sendable {
        /// ファイル変更通知（relDir: root からの相対ディレクトリ）
        let onFsChange: @Sendable (String) -> Void
        /// git status 変更通知
        let onGitStatusChange: @Sendable () -> Void
        /// ブランチ変更通知
        let onBranchChange: @Sendable () -> Void
    }

    private let callbacks: Callbacks
    private let queue = DispatchQueue(label: "gozd.filewatcher")

    /// FSEvents ストリーム
    private var eventStream: FSEventStreamRef?
    /// git 関連ファイルの DispatchSource 群
    private var gitFileSources: [DispatchSourceFileSystemObject] = []
    /// refs/heads ディレクトリの FSEvents ストリーム
    private var refsStream: FSEventStreamRef?

    /// 世代管理（非同期初期化中の stopWatching による stale 登録を防止）
    private var generation: Int = 0

    /// git status 更新のデバウンス
    private var gitStatusTimer: DispatchSourceTimer?
    private static let gitStatusDebounceMs = 200

    /// ブランチ変更のデバウンス
    private var branchChangeTimer: DispatchSourceTimer?
    private static let branchChangeDebounceMs = 300

    init(callbacks: Callbacks) {
        self.callbacks = callbacks
    }

    deinit {
        stopWatching()
    }

    // MARK: - Public

    /// ワークスペースの監視を開始する
    func startWatching(root: String, isGitRepo: Bool = true) {
        queue.sync {
            // 既存の監視を停止し世代を進める
            stopWatchingInternal()
            generation += 1
        }

        let currentGen = generation

        // ワークスペース全体の FSEvents 監視
        startFSEventStream(root: root, isGitRepo: isGitRepo)

        guard isGitRepo else { return }

        // git 関連ファイルの監視を非同期で初期化
        Task {
            await self.setupGitWatching(root: root, generation: currentGen)
        }
    }

    /// 監視を停止する
    func stopWatching() {
        queue.sync {
            stopWatchingInternal()
            generation += 1
        }
    }

    // MARK: - FSEvents（ワークスペース全体）

    private func startFSEventStream(root: String, isGitRepo: Bool) {
        let pathsToWatch = [root] as CFArray
        let callbacks = self.callbacks

        var context = FSEventStreamContext()
        // isGitRepo フラグをコンテキストに渡す（UnsafeMutableRawPointer 経由）
        let info = Unmanaged.passRetained(
            FileWatcherInfo(
                callbacks: callbacks,
                isGitRepo: isGitRepo,
                scheduleGitStatus: { [weak self] in self?.scheduleGitStatusUpdate() }
            )
        )
        context.info = info.toOpaque()

        let stream = FSEventStreamCreate(
            kCFAllocatorDefault,
            fsEventCallback,
            &context,
            pathsToWatch,
            UInt64(kFSEventStreamEventIdSinceNow),
            0.3,  // latency（秒）
            UInt32(
                kFSEventStreamCreateFlagFileEvents
                    | kFSEventStreamCreateFlagUseCFTypes
                    | kFSEventStreamCreateFlagNoDefer
            )
        )

        guard let stream else {
            info.release()
            return
        }

        FSEventStreamSetDispatchQueue(stream, queue)
        FSEventStreamStart(stream)
        eventStream = stream
    }

    // MARK: - Git ファイル監視

    private func setupGitWatching(root: String, generation gen: Int) async {
        // git ディレクトリを解決（linked worktree 対応）
        guard let gitDir = await resolveGitDir(root: root) else { return }
        guard isCurrentGeneration(gen) else { return }

        let indexPath = (gitDir as NSString).appendingPathComponent("index")
        let headPath = (gitDir as NSString).appendingPathComponent("HEAD")

        // index ファイルの監視
        if let source = watchFile(path: indexPath, handler: { [weak self] in
            self?.scheduleGitStatusUpdate()
        }) {
            queue.sync { gitFileSources.append(source) }
        }

        guard isCurrentGeneration(gen) else { return }

        // HEAD ファイルの監視
        if let source = watchFile(path: headPath, handler: { [weak self] in
            // HEAD が変わったら ref の再解決 + git status 更新
            Task {
                await self?.updateRefWatches(root: root, headPath: headPath, generation: gen)
            }
            self?.scheduleGitStatusUpdate()
        }) {
            queue.sync { gitFileSources.append(source) }
        }

        guard isCurrentGeneration(gen) else { return }

        // 現在の ref ファイルの監視
        if let refPath = await resolveCurrentRefPath(root: root, headPath: headPath) {
            guard isCurrentGeneration(gen) else { return }
            if let source = watchFile(path: refPath, handler: { [weak self] in
                self?.scheduleGitStatusUpdate()
            }) {
                queue.sync { gitFileSources.append(source) }
            }
        }

        // リモート追跡 ref の監視
        if let remoteRefPath = await resolveRemoteRefPath(root: root, headPath: headPath) {
            guard isCurrentGeneration(gen) else { return }
            if let source = watchFile(path: remoteRefPath, handler: { [weak self] in
                self?.scheduleGitStatusUpdate()
            }) {
                queue.sync { gitFileSources.append(source) }
            }
        }

        guard isCurrentGeneration(gen) else { return }

        // refs/heads ディレクトリの監視（ブランチ作成・削除を検知）
        if let refsHeadsDir = await resolveRefPath(root: root, refName: "refs/heads") {
            guard isCurrentGeneration(gen) else { return }
            startRefsStream(path: refsHeadsDir)
        }

        // packed-refs の監視（git gc 後のブランチ変更検知）
        if let packedRefsPath = await resolveRefPath(root: root, refName: "packed-refs") {
            guard isCurrentGeneration(gen) else { return }
            if let source = watchFile(path: packedRefsPath, handler: { [weak self] in
                self?.scheduleBranchChange()
            }) {
                queue.sync { gitFileSources.append(source) }
            }
        }
    }

    /// HEAD が変わったときに ref の監視を更新する
    private func updateRefWatches(root: String, headPath: String, generation gen: Int) async {
        guard isCurrentGeneration(gen) else { return }

        if let refPath = await resolveCurrentRefPath(root: root, headPath: headPath) {
            guard isCurrentGeneration(gen) else { return }
            if let source = watchFile(path: refPath, handler: { [weak self] in
                self?.scheduleGitStatusUpdate()
            }) {
                queue.sync { self.gitFileSources.append(source) }
            }
        }

        if let remoteRefPath = await resolveRemoteRefPath(root: root, headPath: headPath) {
            guard isCurrentGeneration(gen) else { return }
            if let source = watchFile(path: remoteRefPath, handler: { [weak self] in
                self?.scheduleGitStatusUpdate()
            }) {
                queue.sync { self.gitFileSources.append(source) }
            }
        }
    }

    /// refs/heads ディレクトリの FSEvents 監視
    private func startRefsStream(path: String) {
        let pathsToWatch = [path] as CFArray
        let callbacks = self.callbacks
        let info = Unmanaged.passRetained(
            FileWatcherInfo(
                callbacks: callbacks,
                isGitRepo: true,
                scheduleGitStatus: { },
                scheduleBranch: { [weak self] in self?.scheduleBranchChange() }
            )
        )
        var context = FSEventStreamContext()
        context.info = info.toOpaque()

        let stream = FSEventStreamCreate(
            kCFAllocatorDefault,
            refsEventCallback,
            &context,
            pathsToWatch,
            UInt64(kFSEventStreamEventIdSinceNow),
            0.3,
            UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes)
        )

        guard let stream else {
            info.release()
            return
        }

        FSEventStreamSetDispatchQueue(stream, queue)
        FSEventStreamStart(stream)
        refsStream = stream
    }

    // MARK: - DispatchSource によるファイル監視

    /// 個別ファイルを DispatchSource で監視する
    private func watchFile(
        path: String,
        handler: @escaping @Sendable () -> Void
    ) -> DispatchSourceFileSystemObject? {
        let fd = open(path, O_EVTONLY)
        guard fd >= 0 else { return nil }

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .delete, .rename, .extend],
            queue: queue
        )

        source.setEventHandler {
            handler()
        }

        source.setCancelHandler {
            close(fd)
        }

        source.activate()
        return source
    }

    // MARK: - デバウンス

    private func scheduleGitStatusUpdate() {
        queue.async { [weak self] in
            guard let self else { return }
            gitStatusTimer?.cancel()
            let timer = DispatchSource.makeTimerSource(queue: queue)
            timer.schedule(
                deadline: .now() + .milliseconds(Self.gitStatusDebounceMs)
            )
            timer.setEventHandler { [weak self] in
                self?.callbacks.onGitStatusChange()
            }
            timer.activate()
            gitStatusTimer = timer
        }
    }

    private func scheduleBranchChange() {
        queue.async { [weak self] in
            guard let self else { return }
            branchChangeTimer?.cancel()
            let timer = DispatchSource.makeTimerSource(queue: queue)
            timer.schedule(
                deadline: .now() + .milliseconds(Self.branchChangeDebounceMs)
            )
            timer.setEventHandler { [weak self] in
                self?.callbacks.onBranchChange()
            }
            timer.activate()
            branchChangeTimer = timer
        }
    }

    // MARK: - 世代チェック

    private func isCurrentGeneration(_ gen: Int) -> Bool {
        queue.sync { generation == gen }
    }

    // MARK: - 停止（内部用、queue 内で呼ぶ）

    private func stopWatchingInternal() {
        // FSEvents ストリーム停止
        if let stream = eventStream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            eventStream = nil
        }

        if let stream = refsStream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            refsStream = nil
        }

        // git ファイル監視停止
        for source in gitFileSources {
            source.cancel()
        }
        gitFileSources.removeAll()

        // タイマー停止
        gitStatusTimer?.cancel()
        gitStatusTimer = nil
        branchChangeTimer?.cancel()
        branchChangeTimer = nil
    }

    // MARK: - Git ヘルパー

    /// git rev-parse --git-dir で git ディレクトリを解決（linked worktree 対応）
    private func resolveGitDir(root: String) async -> String? {
        await runGitCommand(root: root, args: ["rev-parse", "--git-dir"])
    }

    /// git rev-parse --git-path でリファレンス名を実ファイルパスに解決
    private func resolveRefPath(root: String, refName: String) async -> String? {
        await runGitCommand(root: root, args: ["rev-parse", "--git-path", refName])
    }

    /// HEAD が指す ref の実ファイルパスを解決する
    private func resolveCurrentRefPath(root: String, headPath: String) async -> String? {
        guard let headContent = try? String(contentsOfFile: headPath, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) else {
            return nil
        }
        guard headContent.hasPrefix("ref: ") else { return nil }  // detached HEAD
        let refName = String(headContent.dropFirst(5))
        return await resolveRefPath(root: root, refName: refName)
    }

    /// リモート追跡 ref のパスを解決する（refs/heads/foo → refs/remotes/origin/foo）
    private func resolveRemoteRefPath(root: String, headPath: String) async -> String? {
        guard let headContent = try? String(contentsOfFile: headPath, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines) else {
            return nil
        }
        guard headContent.hasPrefix("ref: ") else { return nil }
        let refName = String(headContent.dropFirst(5))
        guard refName.hasPrefix("refs/heads/") else { return nil }
        let branchName = String(refName.dropFirst("refs/heads/".count))
        return await resolveRefPath(root: root, refName: "refs/remotes/origin/\(branchName)")
    }

    /// git コマンドを実行し、stdout の trim 結果を返す
    private func runGitCommand(root: String, args: [String]) async -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = args
        process.currentDirectoryURL = URL(fileURLWithPath: root)

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()

        do {
            try process.run()
        } catch {
            return nil
        }

        process.waitUntilExit()
        guard process.terminationStatus == 0 else { return nil }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: data, encoding: .utf8) else { return nil }
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        // 相対パスなら root を基準に絶対パスにする
        if trimmed.hasPrefix("/") {
            return trimmed
        }
        return (root as NSString).appendingPathComponent(trimmed)
    }
}

// MARK: - FSEvents コールバック

/// FSEvents コールバックに渡すコンテキスト情報
private final class FileWatcherInfo: @unchecked Sendable {
    let callbacks: FileWatcher.Callbacks
    let isGitRepo: Bool
    let scheduleGitStatus: @Sendable () -> Void
    let scheduleBranch: @Sendable () -> Void

    init(
        callbacks: FileWatcher.Callbacks,
        isGitRepo: Bool,
        scheduleGitStatus: @escaping @Sendable () -> Void,
        scheduleBranch: @escaping @Sendable () -> Void = { }
    ) {
        self.callbacks = callbacks
        self.isGitRepo = isGitRepo
        self.scheduleGitStatus = scheduleGitStatus
        self.scheduleBranch = scheduleBranch
    }
}

/// ワークスペースの FSEvents コールバック
private func fsEventCallback(
    _ stream: ConstFSEventStreamRef,
    _ clientCallBackInfo: UnsafeMutableRawPointer?,
    _ numEvents: Int,
    _ eventPaths: UnsafeMutableRawPointer,
    _ eventFlags: UnsafePointer<FSEventStreamEventFlags>,
    _ eventIds: UnsafePointer<FSEventStreamEventId>
) {
    guard let info = clientCallBackInfo else { return }
    let watcherInfo = Unmanaged<FileWatcherInfo>.fromOpaque(info).takeUnretainedValue()

    let paths = Unmanaged<CFArray>.fromOpaque(eventPaths).takeUnretainedValue()
    let count = CFArrayGetCount(paths)

    for i in 0..<count {
        guard let pathPtr = CFArrayGetValueAtIndex(paths, i) else { continue }
        let cfPath = Unmanaged<CFString>.fromOpaque(pathPtr).takeUnretainedValue()
        let path = cfPath as String

        // .git 内部の変更は無視
        if path.contains("/.git/") { continue }
        // node_modules の変更は無視
        if path.contains("/node_modules/") { continue }

        // relDir を計算して通知
        let relDir = (path as NSString).deletingLastPathComponent
        watcherInfo.callbacks.onFsChange(relDir)

        if watcherInfo.isGitRepo {
            watcherInfo.scheduleGitStatus()
        }
    }
}

/// refs/heads ディレクトリの FSEvents コールバック
private func refsEventCallback(
    _ stream: ConstFSEventStreamRef,
    _ clientCallBackInfo: UnsafeMutableRawPointer?,
    _ numEvents: Int,
    _ eventPaths: UnsafeMutableRawPointer,
    _ eventFlags: UnsafePointer<FSEventStreamEventFlags>,
    _ eventIds: UnsafePointer<FSEventStreamEventId>
) {
    guard let info = clientCallBackInfo else { return }
    let watcherInfo = Unmanaged<FileWatcherInfo>.fromOpaque(info).takeUnretainedValue()
    watcherInfo.scheduleBranch()
}
