import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

export const useGitGraphStore = defineStore("gitGraph", () => {
  /** 選択中のコミットハッシュ。null は未選択 */
  const selectedHash = ref<string | null>(null);

  function select(hash: string) {
    selectedHash.value = hash;
  }

  function clearSelection() {
    selectedHash.value = null;
  }

  return { selectedHash, select, clearSelection };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGitGraphStore, import.meta.hot));
}
