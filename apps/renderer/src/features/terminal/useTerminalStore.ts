import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

/**
 * 訪問済み worktree ディレクトリを管理する。
 * worktree ごとに TerminalPane を保持し、v-show で表示を切り替えるために使う。
 */
export const useTerminalStore = defineStore("terminal", () => {
  /** 訪問済みの worktree ディレクトリ一覧（初回訪問順） */
  const visitedDirs = ref<string[]>([]);

  /** worktree を訪問したときに呼ぶ。未登録なら追加する */
  function visit(dir: string) {
    if (!visitedDirs.value.includes(dir)) {
      visitedDirs.value.push(dir);
    }
  }

  /** worktree 削除時に呼ぶ。visitedDirs から除去し、TerminalPane を破棄させる */
  function remove(dir: string) {
    visitedDirs.value = visitedDirs.value.filter((d) => d !== dir);
  }

  return { visitedDirs, visit, remove };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTerminalStore, import.meta.hot));
}
