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
 * git diff-tree の出力を gitStatus と同じ Record<path, statusCode> 形式で返す。
 * statusCode は porcelain v1 互換（例: "M " = index 側 modified）。
 */
export async function getGitCommitFiles(
  cwd: string,
  hash: string,
): Promise<Record<string, string>> {
  const result = await tryCatch(
    new Response(
      Bun.spawn(["git", "diff-tree", "--no-commit-id", "-r", "--name-status", "-z", hash], {
        cwd,
      }).stdout,
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
      // diff-tree の status は1文字（M, A, D, R 等）。porcelain v1 互換に変換（index 側にセット）
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
