import { ref } from "vue";
import type { GitChangeKind } from "./filer-utils";

/** ファイラーで選択中のファイルパス（相対パス）とその git 変更種別。モジュールレベルで保持し HMR でも状態が消えない */
const selectedPath = ref<string>();
const selectedGitChange = ref<GitChangeKind>();

export function useSelectedPath() {
  function select(path: string, gitChange?: GitChangeKind) {
    selectedPath.value = path;
    selectedGitChange.value = gitChange;
  }

  function clear() {
    selectedPath.value = undefined;
    selectedGitChange.value = undefined;
  }

  return { selectedPath, selectedGitChange, select, clear };
}
