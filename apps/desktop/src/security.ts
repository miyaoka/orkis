import fsp from "node:fs/promises";
import path from "node:path";
import { tryCatch } from "@orkis/shared";

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

export function isAllowedProtocol(raw: string): boolean {
  const result = tryCatch(() => new URL(raw));
  if (!result.ok) return false;
  return ALLOWED_PROTOCOLS.has(result.value.protocol);
}

/** ファイル内容を読み取る（バイナリ判定・サイズ制限付き） */
export async function readFileContent(
  absolutePath: string,
): Promise<{ content: string; isBinary: boolean }> {
  const file = Bun.file(absolutePath);
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB
  if (file.size > MAX_FILE_SIZE) {
    return { content: "", isBinary: true };
  }
  // NUL バイトの有無でバイナリ判定（git と同じ方式）
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.includes(0x00)) {
    return { content: "", isBinary: true };
  }
  const content = new TextDecoder().decode(bytes);
  return { content, isBinary: false };
}

export async function resolveSecurePath(root: string, relPath: string): Promise<string> {
  const resolved = path.resolve(root, relPath);
  const real = await fsp.realpath(resolved);
  const realRoot = await fsp.realpath(root);
  const relative = path.relative(realRoot, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: path is outside workspace root");
  }
  return real;
}

/** ファイルが存在しなくてもパストラバーサルだけを防ぐチェック（git 操作用） */
export function assertInsideRoot(root: string, relPath: string): void {
  const resolved = path.resolve(root, relPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: path is outside workspace root");
  }
}
