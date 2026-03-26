import type { GitCommit } from "@gozd/rpc";
import { describe, expect, test } from "bun:test";
import { mergeCommitStreams } from "./mergeCommitStreams";

/** テスト用の GitCommit を簡易生成する */
function commit({
  hash,
  parents = [],
  date = 0,
  refs = [],
}: {
  hash: string;
  parents?: string[];
  date?: number;
  refs?: string[];
}): GitCommit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    parents,
    author: "test",
    date,
    message: hash,
    refs,
  };
}

/** コミット配列からハッシュだけ取り出す */
function hashes(commits: GitCommit[]): string[] {
  return commits.map((c) => c.hash);
}

describe("mergeCommitStreams", () => {
  test("defaultBranchCommits が空なら headCommits をそのまま返す", () => {
    const head = [commit({ hash: "a", date: 3 }), commit({ hash: "b", date: 2 })];
    const result = mergeCommitStreams({ headCommits: head, defaultBranchCommits: [] });
    expect(hashes(result)).toEqual(["a", "b"]);
  });

  test("共有コミットがない場合は headCommits のみ返す", () => {
    const head = [commit({ hash: "a", date: 3 }), commit({ hash: "b", date: 2 })];
    const def = [commit({ hash: "x", date: 5 }), commit({ hash: "y", date: 4 })];
    const result = mergeCommitStreams({ headCommits: head, defaultBranchCommits: def });
    expect(hashes(result)).toEqual(["a", "b"]);
  });

  test("繋がる場合は default 側の差分を追加してトポソートする", () => {
    // head: a -> b -> base
    // default: d -> base
    const base = commit({ hash: "base", parents: [], date: 1 });
    const b = commit({ hash: "b", parents: ["base"], date: 2 });
    const a = commit({ hash: "a", parents: ["b"], date: 4 });
    const d = commit({ hash: "d", parents: ["base"], date: 3 });

    const result = mergeCommitStreams({
      headCommits: [a, b, base],
      defaultBranchCommits: [d, base],
    });

    const h = hashes(result);
    // a, d は base より前に出る
    expect(h.indexOf("a")).toBeLessThan(h.indexOf("base"));
    expect(h.indexOf("d")).toBeLessThan(h.indexOf("base"));
    // b は base より前に出る
    expect(h.indexOf("b")).toBeLessThan(h.indexOf("base"));
    // d が含まれている
    expect(h).toContain("d");
    // base は重複しない
    expect(h.filter((x) => x === "base")).toHaveLength(1);
  });

  test("date-order で共有コミットが途中に混在するケース", () => {
    // default 側の date-order: M, F(shared), D1
    // M はマージコミットで親が D1 と F
    // F は head 側にも存在する共有コミット
    // D1 は M の第1親で default-only
    const f = commit({ hash: "F", parents: [], date: 5 });
    const d1 = commit({ hash: "D1", parents: [], date: 3 });
    const m = commit({ hash: "M", parents: ["D1", "F"], date: 6 });

    // head 側: h1 -> F
    const h1 = commit({ hash: "h1", parents: ["F"], date: 7 });

    const result = mergeCommitStreams({
      headCommits: [h1, f],
      // date-order: M(6), F(5), D1(3) — F が途中に混在
      defaultBranchCommits: [m, f, d1],
    });

    const h = hashes(result);
    // M と D1 が含まれている（打ち切りで D1 が落ちない）
    expect(h).toContain("M");
    expect(h).toContain("D1");
    // 親子関係: M は D1 より後に出ない（M -> D1 なので M が先）
    expect(h.indexOf("M")).toBeLessThan(h.indexOf("D1"));
    // h1 は F より前
    expect(h.indexOf("h1")).toBeLessThan(h.indexOf("F"));
  });

  test("head と default が完全に同じコミットの場合は重複しない", () => {
    const a = commit({ hash: "a", parents: ["b"], date: 2 });
    const b = commit({ hash: "b", parents: [], date: 1 });

    const result = mergeCommitStreams({
      headCommits: [a, b],
      defaultBranchCommits: [a, b],
    });

    expect(hashes(result)).toEqual(["a", "b"]);
  });

  test("トポソートの tie-break は date 降順", () => {
    // base から a(date=5) と b(date=3) が分岐。親子関係なし
    const base = commit({ hash: "base", parents: [], date: 1 });
    const a = commit({ hash: "a", parents: ["base"], date: 5 });
    const b = commit({ hash: "b", parents: ["base"], date: 3 });

    const result = mergeCommitStreams({
      headCommits: [a, base],
      defaultBranchCommits: [b, base],
    });

    const h = hashes(result);
    // a(date=5) が b(date=3) より先
    expect(h.indexOf("a")).toBeLessThan(h.indexOf("b"));
  });
});
