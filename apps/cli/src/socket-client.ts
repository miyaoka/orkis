import net from "node:net";
import { tryCatch } from "@orkis/shared";

/** stable → dev の順で探す */
const SOCKET_CANDIDATES = ["/tmp/orkis-stable.sock", "/tmp/orkis-dev.sock"];

interface HookMessage {
  type: "hook";
  event: "running" | "done" | "needs-input";
  payload: Record<string, unknown>;
}

interface OpenMessage {
  type: "open";
  dir: string;
  file?: string;
}

type OrkisMessage = HookMessage | OpenMessage;

/** ソケットに接続してメッセージを送信する。接続失敗時は reject する。 */
function trySend(socketPath: string, message: OrkisMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(message) + "\n");
      client.end();
    });

    client.on("end", () => {
      resolve();
    });

    client.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * ソケット候補を順に試してメッセージを送信する。
 * すべて失敗した場合はエラーを reject する。
 */
async function sendMessage(message: OrkisMessage): Promise<void> {
  for (const socketPath of SOCKET_CANDIDATES) {
    const result = await tryCatch(trySend(socketPath, message));
    if (result.ok) return;
  }
  throw new Error("orkis アプリが起動していません");
}

export { sendMessage };
export type { HookMessage, OpenMessage, OrkisMessage };
