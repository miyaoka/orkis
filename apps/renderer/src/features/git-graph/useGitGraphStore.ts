import { UNCOMMITTED_HASH } from "@gozd/rpc";
import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

export const useGitGraphStore = defineStore("gitGraph", () => {
  /** 選択中のコミットハッシュ。未選択時は UNCOMMITTED_HASH にフォールバック */
  const selectedHash = ref<string>(UNCOMMITTED_HASH);
  /** shift+クリックで指定した比較対象のコミットハッシュ。null は単一選択モード */
  const compareHash = ref<string | null>(null);
  /** ユーザー操作による選択のバージョン。select / selectCompare でのみインクリメント */
  const selectionVersion = ref(0);

  function select(hash: string) {
    selectedHash.value = hash;
    compareHash.value = null;
    selectionVersion.value++;
  }

  /** shift+クリックで範囲選択の終点を指定する */
  function selectCompare(hash: string) {
    compareHash.value = hash;
    selectionVersion.value++;
  }

  function resetSelection() {
    selectedHash.value = UNCOMMITTED_HASH;
    compareHash.value = null;
  }

  return { selectedHash, compareHash, selectionVersion, select, selectCompare, resetSelection };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGitGraphStore, import.meta.hot));
}
