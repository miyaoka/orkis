/**
 * electrobun/view の互換シム（native SwiftUI WebView 用）
 *
 * gozd-rpc:// カスタムスキーム + window.__gozdReceive で
 * Electrobun RPC の request/send/message API を再現する。
 *
 * Vite alias で electrobun/view → このファイルに差し替えることで、
 * renderer の feature コードを一切変更せずに native WebView で動作する。
 */
import type { GozdRPC } from "@gozd/rpc";

type WebviewMessages = GozdRPC["webview"]["messages"];

// bun → webview メッセージのハンドラーマップ
type MessageHandlers = {
  [K in keyof WebviewMessages]?: (payload: WebviewMessages[K]) => void;
};

let registeredHandlers: MessageHandlers = {};

// Swift → WebView メッセージの受信エントリポイント
// Swift 側が callJavaScript("window.__gozdReceive?.('type', payload)") で呼び出す
Object.defineProperty(window, "__gozdReceive", {
  value: (type: string, payload: unknown) => {
    const handler = registeredHandlers[type as keyof WebviewMessages];
    if (handler) {
      (handler as (p: never) => void)(payload as never);
    }
  },
  writable: true,
  configurable: true,
});

/**
 * Electrobun の Electroview.defineRPC() 互換
 *
 * 戻り値の rpc オブジェクトが request / send プロキシを持つ。
 * - request.<name>(params) → fetch("gozd-rpc://<name>") → Promise<Response>
 * - send.<name>(payload) → fetch("gozd-rpc://<name>") → void (fire-and-forget)
 */
function defineRPC<_Schema>(config: {
  maxRequestTime?: number;
  handlers: {
    requests?: Record<string, unknown>;
    messages?: MessageHandlers;
  };
}) {
  // handlers.messages を登録
  if (config.handlers.messages) {
    registeredHandlers = config.handlers.messages;
  }

  const maxRequestTime = config.maxRequestTime ?? 5000;

  // request プロキシ: request.<name>(params) → Promise<response>
  const request = new Proxy(
    {},
    {
      get(_target, name: string) {
        return async (params?: unknown) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), maxRequestTime);

          const res = await fetch(`gozd-rpc://${name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params ?? null),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`RPC request failed: ${name} (${res.status}) ${text}`);
          }

          const text = await res.text();
          // "null" や空文字の場合は undefined を返す（void レスポンス対応）
          if (!text || text === "null") return undefined;
          return JSON.parse(text) as unknown;
        };
      },
    },
  );

  // send プロキシ: send.<name>(payload) → void (fire-and-forget)
  const send = new Proxy(
    {},
    {
      get(_target, name: string) {
        return (payload?: unknown) => {
          // fire-and-forget: レスポンスを待たない
          void fetch(`gozd-rpc://${name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload ?? null),
          });
        };
      },
    },
  );

  return { request, send };
}

/** Electroview クラスの互換実装 */
class Electroview {
  rpc: ReturnType<typeof defineRPC>;

  constructor(config: { rpc: ReturnType<typeof defineRPC> }) {
    this.rpc = config.rpc;
  }

  /** Electrobun の Electroview.defineRPC 互換 */
  static defineRPC = defineRPC;
}

// electrobun/view のエクスポート互換
// import Electrobun, { Electroview } from "electrobun/view" に対応
export default { Electroview };
export { Electroview };
