import Foundation
import Network

/// Unix ドメインソケットで NDJSON メッセージを受信するサーバー
///
/// CLI（gozd コマンド）や Claude Code hooks からの通知を受け取る。
/// メッセージ型:
/// - HookMessage: Claude hooks イベント（session-start, done, needs-input 等）
/// - OpenMessage: プロジェクトを開く要求
final class SocketServer: @unchecked Sendable {
    /// 受信メッセージのコールバック
    let onMessage: @Sendable (GozdMessage) -> Void

    private let queue = DispatchQueue(label: "gozd.socket")
    private var listener: NWListener?
    private var connections: [NWConnection] = []
    private let socketPath: String

    init(socketPath: String, onMessage: @escaping @Sendable (GozdMessage) -> Void) {
        self.socketPath = socketPath
        self.onMessage = onMessage
    }

    deinit {
        stop()
    }

    // MARK: - Public

    /// ソケットサーバーを起動する
    func start() {
        // 既存のソケットファイルを削除
        let fm = FileManager.default
        if fm.fileExists(atPath: socketPath) {
            try? fm.removeItem(atPath: socketPath)
        }

        let params = NWParameters()
        params.defaultProtocolStack.transportProtocol = NWProtocolTCP.Options()
        params.requiredLocalEndpoint = NWEndpoint.unix(path: socketPath)

        do {
            listener = try NWListener(using: params)
        } catch {
            print("[socket] listener creation failed: \(error)")
            return
        }

        listener?.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("[socket] listening on \(self?.socketPath ?? "")")
            case .failed(let error):
                print("[socket] server error: \(error)")
            default:
                break
            }
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleNewConnection(connection)
        }

        listener?.start(queue: queue)
    }

    /// ソケットサーバーを停止する
    func stop() {
        listener?.cancel()
        listener = nil

        for connection in connections {
            connection.cancel()
        }
        connections.removeAll()

        // ソケットファイルを削除
        try? FileManager.default.removeItem(atPath: socketPath)
    }

    /// ソケットパス
    var path: String { socketPath }

    // MARK: - Private

    private func handleNewConnection(_ connection: NWConnection) {
        connections.append(connection)

        connection.stateUpdateHandler = { [weak self, weak connection] state in
            if case .cancelled = state {
                guard let self, let connection else { return }
                self.connections.removeAll { $0 === connection }
            }
        }

        connection.start(queue: queue)
        receiveData(from: connection, buffer: "")
    }

    /// NDJSON: 改行区切りで JSON を受信し、行単位でパースする
    private func receiveData(from connection: NWConnection, buffer: String) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) {
            [weak self] content, _, isComplete, error in

            guard let self else { return }

            var currentBuffer = buffer

            if let content, let text = String(data: content, encoding: .utf8) {
                currentBuffer += text
                let lines = currentBuffer.split(
                    separator: "\n", omittingEmptySubsequences: false)

                // 最後の要素は未完成の可能性があるのでバッファに保持
                currentBuffer = String(lines.last ?? "")

                for line in lines.dropLast() {
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { continue }

                    guard let data = trimmed.data(using: .utf8) else { continue }
                    do {
                        let message = try JSONDecoder().decode(GozdMessage.self, from: data)
                        self.onMessage(message)
                    } catch {
                        print("[socket] invalid JSON: \(trimmed) — \(error)")
                    }
                }
            }

            if isComplete || error != nil {
                connection.cancel()
                return
            }

            // 次のデータを待つ
            self.receiveData(from: connection, buffer: currentBuffer)
        }
    }
}

// MARK: - メッセージ型

/// ソケット経由で受信するメッセージの共通型
enum GozdMessage: Decodable, Sendable {
    case hook(HookMessage)
    case open(OpenMessage)

    private enum CodingKeys: String, CodingKey {
        case type
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "hook":
            self = .hook(try HookMessage(from: decoder))
        case "open":
            self = .open(try OpenMessage(from: decoder))
        default:
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: [CodingKeys.type],
                    debugDescription: "Unknown message type: \(type)"
                )
            )
        }
    }
}

/// Claude hooks イベントメッセージ
struct HookMessage: Decodable, Sendable {
    let type: String
    let event: String
    let payload: HookPayload
}

/// Hook ペイロード（ptyId は必須、追加フィールドは任意）
struct HookPayload: Decodable, Sendable {
    let ptyId: Int?
    /// last_assistant_message（done / stop-failure イベント）
    let lastAssistantMessage: String?
    /// tool_name（needs-input イベント）
    let toolName: String?
    /// tool_input（needs-input イベント）
    let toolInput: String?
    /// is_interrupt（tool-failure イベント）
    let isInterrupt: Bool?

    private enum CodingKeys: String, CodingKey {
        case ptyId
        case lastAssistantMessage = "last_assistant_message"
        case toolName = "tool_name"
        case toolInput = "tool_input"
        case isInterrupt = "is_interrupt"
    }
}

/// プロジェクトを開く要求メッセージ
struct OpenMessage: Decodable, Sendable {
    let type: String
    /// CLI から受け取った絶対パス
    let targetPath: String
}

// MARK: - ソケットパスの生成

/// チャンネルに基づいたソケットパスを生成する
func socketPath(channel: String) -> String {
    let tmpDir = NSTemporaryDirectory()
    return (tmpDir as NSString).appendingPathComponent("gozd-\(channel).sock")
}
