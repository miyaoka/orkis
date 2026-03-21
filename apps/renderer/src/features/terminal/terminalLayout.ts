import type { Ref } from "vue";
import type { SplitDirection, SplitNode } from "./splitTree";
import {
  collectLeafIds,
  createLeaf,
  removeNode,
  resizeBranch as resizeBranchFn,
  splitNode,
} from "./splitTree";

interface TerminalLayoutState {
  root: SplitNode;
  focusedLeafId: string;
}

interface PaneEntry {
  dir: string;
}

interface TerminalLayoutDeps {
  layoutsByDir: Ref<Record<string, TerminalLayoutState>>;
  visitedDirs: Ref<string[]>;
  paneRegistry: Ref<Record<string, PaneEntry>>;
  /** フォーカス中のペインを閉じるときに terminalFocus をリセットする */
  resetTerminalFocus: () => void;
  /** ペイン削除時に PTY kill + 関連リソースのクリーンアップを行う */
  onPaneRemoved: (leafId: string) => void;
}

export type { TerminalLayoutState };

export function createTerminalLayout(deps: TerminalLayoutDeps) {
  const { layoutsByDir, visitedDirs, paneRegistry, resetTerminalFocus, onPaneRemoved } = deps;

  /** layoutsByDir[dir] を返す。未登録なら初期リーフで作成する */
  function ensureLayout(dir: string): TerminalLayoutState {
    const existing = layoutsByDir.value[dir];
    if (existing !== undefined) return existing;

    const leaf = createLeaf();
    const layout: TerminalLayoutState = {
      root: leaf,
      focusedLeafId: leaf.id,
    };
    layoutsByDir.value[dir] = layout;
    paneRegistry.value[leaf.id] = { dir };
    return layout;
  }

  /** worktree を訪問したときに呼ぶ。未登録なら追加する */
  function visit(dir: string) {
    if (!visitedDirs.value.includes(dir)) {
      visitedDirs.value.push(dir);
    }
    ensureLayout(dir);
  }

  /** フォーカス中のリーフを分割する */
  function splitPane(dir: string, direction: SplitDirection) {
    const layout = layoutsByDir.value[dir];
    if (layout === undefined) return;

    const result = splitNode(layout.root, layout.focusedLeafId, direction);
    if (!result.changed) return;

    layoutsByDir.value[dir] = {
      root: result.root,
      focusedLeafId: result.nextFocusedLeafId,
    };

    if (result.createdLeafId !== undefined) {
      paneRegistry.value[result.createdLeafId] = { dir };
    }
  }

  /**
   * ペインを閉じる。削除可否を先に判定してから副作用を実行する。
   * @returns 実際に閉じた場合 true。最後の1リーフ等で閉じられなかった場合 false
   */
  function closePane(dir: string, leafId: string): boolean {
    const layout = layoutsByDir.value[dir];
    if (layout === undefined) return false;

    // 最後の1リーフや存在しない leafId では changed: false で何もしない
    const result = removeNode(layout.root, leafId);
    if (!result.changed) return false;

    // フォーカス中のペインを閉じる場合、unmount より先に terminalFocus をリセット
    if (leafId === layout.focusedLeafId) {
      resetTerminalFocus();
    }

    // 削除確定後に PTY kill + paneRegistry / CWD 削除
    onPaneRemoved(leafId);
    delete paneRegistry.value[leafId];

    layoutsByDir.value[dir] = {
      root: result.root,
      focusedLeafId: result.nextFocusedLeafId,
    };

    return true;
  }

  /**
   * レイアウトをリセットする。現在のPTYをすべてkillし、新しい単一リーフで再構築する。
   * 最後の1ペインを閉じて新ターミナルを開く用途で使う。
   */
  function resetLayout(dir: string) {
    const layout = layoutsByDir.value[dir];
    if (layout === undefined) return;

    // 既存の全ペインを破棄
    for (const [leafId, entry] of Object.entries(paneRegistry.value)) {
      if (entry.dir !== dir) continue;
      onPaneRemoved(leafId);
      delete paneRegistry.value[leafId];
    }

    resetTerminalFocus();

    // 新しい単一リーフで再構築
    const leaf = createLeaf();
    layoutsByDir.value[dir] = {
      root: leaf,
      focusedLeafId: leaf.id,
    };
    paneRegistry.value[leaf.id] = { dir };
  }

  /** branch の ratio を更新する */
  function resizeBranch(dir: string, branchId: string, ratio: number) {
    const layout = layoutsByDir.value[dir];
    if (layout === undefined) return;

    layoutsByDir.value[dir] = {
      ...layout,
      root: resizeBranchFn(layout.root, branchId, ratio),
    };
  }

  /** フォーカスを変更する */
  function focusPane(leafId: string) {
    const entry = paneRegistry.value[leafId];
    if (entry === undefined) return;

    const layout = layoutsByDir.value[entry.dir];
    if (layout === undefined) return;

    layoutsByDir.value[entry.dir] = {
      ...layout,
      focusedLeafId: leafId,
    };
  }

  /**
   * worktree 削除時に呼ぶ。
   * 全 leaf の PTY kill → paneRegistry 掃除 → layoutsByDir 削除 → visitedDirs 削除
   */
  function remove(dir: string) {
    const layout = layoutsByDir.value[dir];
    if (layout !== undefined) {
      const leafIds = collectLeafIds(layout.root);
      for (const leafId of leafIds) {
        onPaneRemoved(leafId);
        delete paneRegistry.value[leafId];
      }
      delete layoutsByDir.value[dir];
    }

    visitedDirs.value = visitedDirs.value.filter((d) => d !== dir);
  }

  return {
    ensureLayout,
    visit,
    splitPane,
    closePane,
    resetLayout,
    resizeBranch,
    focusPane,
    remove,
  };
}
