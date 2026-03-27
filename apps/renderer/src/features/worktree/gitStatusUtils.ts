/**
 * git status --porcelain=v2 のステータスコード（XY の2文字）から変更種別を判定する。
 * X（index）と Y（worktree）のうち、より目立つ方を優先する。
 * v2 では未変更は "."（v1 では " "）。
 */
type GitChangeKind = "modified" | "added" | "deleted" | "untracked" | "renamed";

const GIT_STATUS_KIND_MAP: Record<string, GitChangeKind> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "renamed",
};

/** XY コードで「未変更」を表す文字か判定する（v2: "."） */
function isUnchanged(char: string | undefined): boolean {
  return char === " " || char === "." || char === undefined;
}

function resolveGitChangeKind(statusCode: string): GitChangeKind {
  if (statusCode === "??") return "untracked";
  // worktree 側 (Y) を優先、なければ index 側 (X) を使う
  const [index, worktree] = statusCode;
  if (!isUnchanged(worktree)) {
    return GIT_STATUS_KIND_MAP[worktree] ?? "modified";
  }
  if (!isUnchanged(index)) {
    return GIT_STATUS_KIND_MAP[index] ?? "modified";
  }
  return "modified";
}

/**
 * ファイルパスの git 変更種別を解決する。
 * 直接マッチしない場合、untracked ディレクトリ（末尾 / 付き）の配下かどうかも確認する。
 */
function resolveFileGitChange(
  filePath: string,
  gitStatuses: Record<string, string>,
): GitChangeKind | undefined {
  const statusCode = gitStatuses[filePath];
  if (statusCode) return resolveGitChangeKind(statusCode);
  // untracked ディレクトリの配下ファイル: git status は "dir/" のみ出力し中身は列挙しない
  for (const [path, code] of Object.entries(gitStatuses)) {
    if (code !== "??" || !path.endsWith("/")) continue;
    if (filePath.startsWith(path)) return "untracked";
  }
  return undefined;
}

/**
 * git status マップからディレクトリの変更種別を推論する。
 * 配下の変更種別が1種類ならその種別を返し、複数種別が混在する場合は modified を返す。
 */
function resolveDirectoryGitChange(
  dirPath: string,
  gitStatuses: Record<string, string>,
): GitChangeKind | undefined {
  const prefix = dirPath === "" ? "" : dirPath + "/";
  let found: GitChangeKind | undefined;

  for (const [filePath, statusCode] of Object.entries(gitStatuses)) {
    if (!filePath.startsWith(prefix)) continue;
    const kind = resolveGitChangeKind(statusCode);
    if (found === undefined) {
      found = kind;
    } else if (found !== kind) {
      return "modified";
    }
  }
  return found;
}

type GitStatusIconKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflict";

interface SplitStatusCounts {
  staging: Partial<Record<GitStatusIconKind, number>>;
  working: Partial<Record<GitStatusIconKind, number>>;
}

const INDEX_KIND_MAP: Record<string, GitStatusIconKind> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
};

const WORKTREE_KIND_MAP: Record<string, GitStatusIconKind> = {
  M: "modified",
  D: "deleted",
};

/**
 * git status の XY コードを staging（index）と working tree に分離してカウントする。
 * conflict（unmerged）は working 側にまとめる。
 */
function countSplitChanges(statuses: Record<string, string>): SplitStatusCounts {
  const staging: Partial<Record<GitStatusIconKind, number>> = {};
  const working: Partial<Record<GitStatusIconKind, number>> = {};

  for (const status of Object.values(statuses)) {
    if (status === "??") {
      working.untracked = (working.untracked ?? 0) + 1;
      continue;
    }

    const [x, y] = status;

    // Unmerged: U in either position, or AA/DD (both-added / both-deleted)
    if (x === "U" || y === "U" || status === "AA" || status === "DD") {
      working.conflict = (working.conflict ?? 0) + 1;
      continue;
    }

    // Index side
    if (!isUnchanged(x)) {
      const kind = INDEX_KIND_MAP[x] ?? "modified";
      staging[kind] = (staging[kind] ?? 0) + 1;
    }

    // Worktree side
    if (!isUnchanged(y)) {
      const kind = WORKTREE_KIND_MAP[y] ?? "modified";
      working[kind] = (working[kind] ?? 0) + 1;
    }
  }

  return { staging, working };
}

/** ステータスアイコン定義 */
const STATUS_ICON_CONFIG: Record<GitStatusIconKind, { icon: string; color: string }> = {
  added: { icon: "icon-[lucide--file-plus]", color: "text-green-400" },
  modified: { icon: "icon-[lucide--file-diff]", color: "text-yellow-400" },
  deleted: { icon: "icon-[lucide--file-x]", color: "text-red-400" },
  renamed: { icon: "icon-[lucide--file-input]", color: "text-blue-400" },
  copied: { icon: "icon-[lucide--files]", color: "text-blue-400" },
  untracked: { icon: "icon-[lucide--file-question-mark]", color: "text-green-400" },
  conflict: { icon: "icon-[lucide--file-exclamation-point]", color: "text-red-400" },
};

/** アイコンの表示順 */
const STATUS_ICON_ORDER: GitStatusIconKind[] = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "untracked",
  "conflict",
];

interface StatusIconEntry {
  kind: GitStatusIconKind;
  icon: string;
  color: string;
  count: number;
}

/** カウントをアイコン付きエントリ配列に変換する */
function toStatusIconEntries(
  counts: Partial<Record<GitStatusIconKind, number>>,
): StatusIconEntry[] {
  const result: StatusIconEntry[] = [];
  for (const kind of STATUS_ICON_ORDER) {
    const count = counts[kind];
    if (count && count > 0) {
      const config = STATUS_ICON_CONFIG[kind];
      result.push({ kind, icon: config.icon, color: config.color, count });
    }
  }
  return result;
}

/** git status の生データから staging + working をまとめたアイコン付きエントリを生成する */
function computeStatusIcons(statuses: Record<string, string>): StatusIconEntry[] {
  const { staging, working } = countSplitChanges(statuses);
  const merged: Partial<Record<GitStatusIconKind, number>> = {};
  for (const counts of [staging, working]) {
    for (const [kind, count] of Object.entries(counts)) {
      const k = kind as GitStatusIconKind;
      merged[k] = (merged[k] ?? 0) + (count ?? 0);
    }
  }
  return toStatusIconEntries(merged);
}

export {
  computeStatusIcons,
  resolveDirectoryGitChange,
  resolveFileGitChange,
  resolveGitChangeKind,
};
export type { GitChangeKind, StatusIconEntry };
