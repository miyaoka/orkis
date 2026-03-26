import type { GitCommit } from "@gozd/rpc";

/**
 * HEAD 系統とデフォルトブランチ系統のコミットストリームをマージする。
 *
 * - headCommits の hash set を作り、defaultBranchCommits が到達可能か判定する
 * - 繋がる場合のみ defaultBranchCommits の差分を追加する
 * - union した visible commits を逆トポロジカルソート（Kahn のアルゴリズム）で並べる
 */
export function mergeCommitStreams({
  headCommits,
  defaultBranchCommits,
}: {
  headCommits: GitCommit[];
  defaultBranchCommits: GitCommit[];
}): GitCommit[] {
  if (defaultBranchCommits.length === 0) return headCommits;

  const headHashSet = new Set(headCommits.map((c) => c.hash));

  // defaultBranchCommits を先頭から走査し、headHashSet に含まれるコミットに当たったら「繋がる」
  let connected = false;
  const defaultOnly: GitCommit[] = [];
  for (const commit of defaultBranchCommits) {
    if (headHashSet.has(commit.hash)) {
      connected = true;
      break;
    }
    defaultOnly.push(commit);
  }

  // 繋がらない場合は headCommits のみ
  if (!connected) return headCommits;

  // union: headCommits + defaultBranchCommits のうち headCommits にないもの
  const unionCommits = [...headCommits, ...defaultOnly];

  return topoSort(unionCommits);
}

/**
 * 逆トポロジカルソート（Kahn のアルゴリズム）。
 * child が parent より先に出る順序を保証する。
 * tie-break: commit date 降順（新しいコミットが先）。
 */
function topoSort(commits: GitCommit[]): GitCommit[] {
  const commitMap = new Map<string, GitCommit>();
  for (const c of commits) {
    commitMap.set(c.hash, c);
  }

  // visible な子の数を計算（visible = commitMap に含まれる）
  const childCount = new Map<string, number>();
  for (const c of commits) {
    if (!childCount.has(c.hash)) childCount.set(c.hash, 0);
    for (const parentHash of c.parents) {
      if (commitMap.has(parentHash)) {
        childCount.set(parentHash, (childCount.get(parentHash) ?? 0) + 1);
      }
    }
  }

  // in-degree が 0 のノードを ready queue に入れる
  // priority queue の代わりに配列 + ソートで実装（コミット数が数百件なので十分）
  const ready: GitCommit[] = [];
  for (const c of commits) {
    if (childCount.get(c.hash) === 0) {
      ready.push(c);
    }
  }

  const result: GitCommit[] = [];

  while (ready.length > 0) {
    // tie-break: commit date 降順（新しいコミットが先）
    ready.sort((a, b) => b.date - a.date);
    const commit = ready.shift()!;
    result.push(commit);

    // この commit の親の child count を減らす
    for (const parentHash of commit.parents) {
      const count = childCount.get(parentHash);
      if (count === undefined) continue;
      const newCount = count - 1;
      childCount.set(parentHash, newCount);
      if (newCount === 0) {
        const parent = commitMap.get(parentHash);
        if (parent) ready.push(parent);
      }
    }
  }

  return result;
}
