import { ref } from "vue";

/** モジュールレベルで保持するため HMR でも状態が消えない */
const dir = ref<string>();
const file = ref<string>();
const fileServerBaseUrl = ref<string>();

export function useWorkspace() {
  function setOpen(newDir: string, newFile?: string, newFileServerBaseUrl?: string) {
    dir.value = newDir;
    file.value = newFile;
    if (newFileServerBaseUrl) {
      fileServerBaseUrl.value = newFileServerBaseUrl;
    }
  }

  return { dir, file, fileServerBaseUrl, setOpen };
}
