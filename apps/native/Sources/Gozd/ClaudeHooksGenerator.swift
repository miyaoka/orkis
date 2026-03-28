import Foundation

/// Claude Code の hooks 設定ファイルを生成する
///
/// Claude Code が hooks を発火すると、nc（軽量イベント）または gozd CLI（stdin データ付き）
/// 経由でソケットサーバーにメッセージが送信される。
///
/// 設定ファイルは $TMPDIR に書き出され、PTY の zsh 初期化で
/// `claude --settings $GOZD_CLAUDE_SETTINGS_PATH` として自動注入される。
enum ClaudeHooksGenerator {

    /// hooks 設定ファイルを生成する
    static func generate(settingsPath: String) {
        let settings = buildSettings()

        do {
            let data = try JSONSerialization.data(withJSONObject: settings, options: [.prettyPrinted, .sortedKeys])
            guard var jsonString = String(data: data, encoding: .utf8) else {
                print("[gozd] Claude hooks 設定の JSON 変換に失敗")
                return
            }
            jsonString += "\n"
            try jsonString.write(toFile: settingsPath, atomically: true, encoding: .utf8)
        } catch {
            print("[gozd] Claude hooks 設定の書き出しに失敗: \(error.localizedDescription)")
        }
    }

    /// hooks 設定 JSON を構築する
    private static func buildSettings() -> [String: Any] {
        [
            "hooks": [
                // nc で固定 JSON を直接送信（軽量。stdin のデータは不要なイベント用）
                "SessionStart": [hookEntry(command: ncCommand(event: "session-start"))],
                "SessionEnd": [hookEntry(command: ncCommand(event: "session-end"))],
                "UserPromptSubmit": [hookEntry(command: ncCommand(event: "running"))],

                // CLI 経由で stdin の JSON をパースして送信（stdin データが必要なイベント用）
                "Stop": [hookEntry(command: cliCommand(event: "done"))],
                "StopFailure": [hookEntry(command: cliCommand(event: "stop-failure"))],

                // matcher 付き（全ツール対象）
                "PermissionRequest": [matcherHookEntry(command: cliCommand(event: "needs-input"))],
                "PostToolUse": [matcherHookEntry(command: ncCommand(event: "tool-done"))],
                "PostToolUseFailure": [matcherHookEntry(command: cliCommand(event: "tool-failure"))],
            ] as [String: Any]
        ]
    }

    // MARK: - コマンド生成

    /// nc で固定 JSON を直接ソケットに送信するコマンド
    ///
    /// 軽量で高速。stdin データが不要なイベント（session-start, running, tool-done 等）に使用。
    /// ptyId は環境変数 $GOZD_PTY_ID から取得する。
    private static func ncCommand(event: String) -> String {
        "echo '{\"type\":\"hook\",\"event\":\"\(event)\",\"payload\":{\"ptyId\":'\"$GOZD_PTY_ID\"'}}' | nc -w 1 -U \"$GOZD_SOCKET_PATH\""
    }

    /// gozd CLI 経由で送信するコマンド
    ///
    /// CLI が stdin の JSON を parse して payload にマージするため、
    /// Claude Code が渡す詳細データ（応答テキスト、ツール情報）をフロントまで届けられる。
    /// done, needs-input, tool-failure 等に使用。
    private static func cliCommand(event: String) -> String {
        "$GOZD_CLI_RUNNER \"$GOZD_CLI_PATH\" hook \(event)"
    }

    // MARK: - JSON 構造ヘルパー

    /// matcher なし hook エントリ
    private static func hookEntry(command: String) -> [String: Any] {
        [
            "hooks": [
                ["type": "command", "command": command]
            ]
        ]
    }

    /// matcher 付き hook エントリ（全ツール対象）
    private static func matcherHookEntry(command: String) -> [String: Any] {
        [
            "matcher": "*",
            "hooks": [
                ["type": "command", "command": command]
            ],
        ]
    }
}

// MARK: - Claude hooks 設定パスの生成

/// チャンネルに基づいた Claude hooks 設定ファイルパスを生成する
func claudeSettingsPath(channel: String) -> String {
    let tmpDir = NSTemporaryDirectory()
    return (tmpDir as NSString).appendingPathComponent("gozd-\(channel)-claude-settings.json")
}
