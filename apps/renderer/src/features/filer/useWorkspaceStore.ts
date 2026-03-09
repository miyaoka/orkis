import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref } from "vue";
import { resolveFileGitChange } from "./filer-utils";
import { useGitStatusStore } from "./useGitStatusStore";

export const useWorkspaceStore = defineStore("workspace", () => {
  const dir = ref<string>();
  const fileServerBaseUrl = ref<string>();

  /** ファイラーで選択中のファイルパス（相対パス） */
  const selectedPath = ref<string>();

  const gitStatusStore = useGitStatusStore();

  /** git status から都度算出するため、status 更新時に自動反映される */
  const selectedGitChange = computed(() => {
    if (!selectedPath.value) return undefined;
    return resolveFileGitChange(selectedPath.value, gitStatusStore.gitStatuses);
  });

  /** RPC orkisOpen イベントで呼ばれる */
  function setOpen(newDir: string, newFile?: string, newFileServerBaseUrl?: string) {
    dir.value = newDir;
    if (newFileServerBaseUrl) {
      fileServerBaseUrl.value = newFileServerBaseUrl;
    }
    // CLI から file が指定された場合、選択状態に反映する
    if (newFile) {
      selectedPath.value = newFile;
    }
  }

  function selectPath(path: string) {
    selectedPath.value = path;
  }

  function clearSelectedPath() {
    selectedPath.value = undefined;
  }

  return {
    dir,
    fileServerBaseUrl,
    selectedPath,
    selectedGitChange,
    setOpen,
    selectPath,
    clearSelectedPath,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore, import.meta.hot));
}
