import fs from "node:fs";
import { tryCatch } from "@orkis/shared";

/** hooks 設定ファイルを生成する。nc で直接ソケットに通知する */
export function generateClaudeSettings(settingsPath: string): void {
  const hookCommand = (event: string) =>
    `echo '{"type":"hook","event":"${event}","payload":{"ptyId":'"$ORKIS_PTY_ID"'}}' | nc -U "$ORKIS_SOCKET_PATH"`;

  const settings = {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: "command", command: hookCommand("running"), async: true }] },
      ],
      Stop: [{ hooks: [{ type: "command", command: hookCommand("done"), async: true }] }],
      PermissionRequest: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand("needs-input"), async: true }],
        },
      ],
      PostToolUse: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand("tool-done"), async: true }],
        },
      ],
      PostToolUseFailure: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand("tool-done"), async: true }],
        },
      ],
    },
  };

  const writeResult = tryCatch(() =>
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n"),
  );
  if (!writeResult.ok) {
    console.error("[orkis] Claude hooks 設定の書き出しに失敗:", writeResult.error.message);
  }
}
