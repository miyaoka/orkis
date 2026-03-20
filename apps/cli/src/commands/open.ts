import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { defineCommand } from "@miyaoka/fsss";
import { tryCatch } from "@orkis/shared";
import { z } from "zod";
import { sendMessage } from "../socket-client";

const LAUNCH_DIR = join(tmpdir(), "orkis-stable-launch");

/**
 * パスをワークスペースディレクトリとファイルに分解する。
 * - ディレクトリ → { dir }
 * - ファイル → { dir: 親ディレクトリ, file }
 * - 存在しない → { dir: 親ディレクトリ, file }（新規ファイル扱い）
 */
function resolveTarget(inputPath: string): { dir: string; file?: string } {
  const absolutePath = resolve(inputPath);
  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    return { dir: absolutePath };
  }
  return { dir: dirname(absolutePath), file: absolutePath };
}

/** cold start 用の launch request ファイルを書き出す */
function writeLaunchRequest(request: { dir: string; file?: string }): void {
  mkdirSync(LAUNCH_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.json`;
  writeFileSync(`${LAUNCH_DIR}/${filename}`, JSON.stringify(request));
}

export default defineCommand({
  description: "指定パスを orkis で開く",
  args: {
    path: {
      type: z.string(),
      description: "ディレクトリまたはファイルのパス",
      positional: true,
      default: ".",
    },
  },
  async run({ args }) {
    const target = resolveTarget(args.path);

    // cold start: request ファイルを書いてアプリに渡す（ソケット送信しない）
    if (process.env.ORKIS_COLD_START) {
      writeLaunchRequest({ dir: target.dir, file: target.file });
      return;
    }

    // warm start: ソケット経由で既存アプリに送信
    // パス解決（プロジェクト判定・worktree root 解決）は desktop 側で行う
    const result = await tryCatch(
      sendMessage({ type: "open", dir: target.dir, file: target.file }),
    );
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
  },
});
