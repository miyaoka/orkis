import { tryCatch } from "@gozd/shared";
import type { WorktreeChangeCounts } from "@gozd/rpc";

export async function filterIgnored(entries: string[], cwd: string): Promise<Set<string>> {
  if (entries.length === 0) return new Set();
  const result = await tryCatch(
    new Response(Bun.spawn(["git", "check-ignore", ...entries], { cwd }).stdout).text(),
  );
  if (!result.ok) return new Set();
  const text = result.value;
  return new Set(text.split("\n").filter(Boolean));
}

export async function getGitStatus(cwd: string): Promise<Record<string, string>> {
  const result = await tryCatch(
    new Response(Bun.spawn(["git", "status", "--porcelain=v1", "-z"], { cwd }).stdout).text(),
  );
  if (!result.ok) return {};
  const stdout = result.value;
  const statuses: Record<string, string> = {};
  const parts = stdout.split("\0");
  let i = 0;
  while (i < parts.length) {
    const entry = parts[i];
    if (!entry) {
      i++;
      continue;
    }
    const status = entry.slice(0, 2);
    const filePath = entry.slice(3);
    if (status[0] === "R" || status[0] === "C") {
      i++;
      const newPath = parts[i];
      if (newPath !== undefined) {
        statuses[newPath] = status;
      }
    } else {
      statuses[filePath] = status;
    }
    i++;
  }
  return statuses;
}

/**
 * コミットの変更ファイル一覧を取得する。
 * git diff --name-status の出力を gitStatus と同じ Record<path, statusCode> 形式で返す。
 * statusCode は porcelain v1 互換（例: "M " = index 側 modified）。
 *
 * compareHash 未指定: `hash^1..hash` で first parent との差分。
 * compareHash 指定: 古い方の親から新しい方までの差分（範囲内の全変更ファイルの和集合）。
 */
export async function getGitCommitFiles(
  cwd: string,
  hash: string,
  compareHash?: string,
): Promise<Record<string, string>> {
  let from: string;
  let to: string;
  if (compareHash === undefined) {
    from = `${hash}^1`;
    to = hash;
  } else {
    // 古い方の親を起点に、新しい方を終点にする
    // git merge-base --is-ancestor で順序を判定
    const orderResult = await tryCatch(
      Bun.spawn(["git", "merge-base", "--is-ancestor", hash, compareHash], { cwd }).exited,
    );
    // exit 0 = hash is ancestor of compareHash (hash が古い)
    const hashIsOlder = orderResult.ok && orderResult.value === 0;
    if (hashIsOlder) {
      from = `${hash}^1`;
      to = compareHash;
    } else {
      from = `${compareHash}^1`;
      to = hash;
    }
  }
  const result = await tryCatch(
    new Response(
      Bun.spawn(["git", "diff", "--name-status", "-z", from, to], { cwd }).stdout,
    ).text(),
  );
  if (!result.ok) return {};
  const stdout = result.value;
  const statuses: Record<string, string> = {};
  // -z 出力: status\0path\0status\0path\0...
  const parts = stdout.split("\0");
  let i = 0;
  while (i + 1 < parts.length) {
    const status = parts[i];
    const filePath = parts[i + 1];
    if (status && filePath) {
      // git diff の status は1文字（M, A, D, R 等）。porcelain v1 互換に変換（index 側にセット）
      statuses[filePath] = `${status} `;
    }
    i += 2;
  }
  return statuses;
}

/** git status の2文字コードから変更種別ごとのファイル数を算出 */
export function countChanges(statuses: Record<string, string>): WorktreeChangeCounts {
  let modified = 0;
  let added = 0;
  let deleted = 0;
  let untracked = 0;

  for (const status of Object.values(statuses)) {
    if (status === "??") {
      untracked++;
      continue;
    }
    // worktree 側 (Y) を優先、なければ index 側 (X) を使う
    const code = status[1] !== " " ? status[1] : status[0];
    switch (code) {
      case "A":
        added++;
        break;
      case "D":
        deleted++;
        break;
      default:
        // M, R, C, T, U 等はすべて modified 扱い
        modified++;
        break;
    }
  }

  return { modified, added, deleted, untracked };
}
