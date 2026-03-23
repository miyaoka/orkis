import { useEventListener } from "@vueuse/core";
import { ref } from "vue";
import { useContextKeys } from "../../shared/command";

/**
 * Ctrl キー押下状態の検知。
 * worktree の番号バッジ表示制御に使用する。
 * editable 要素にフォーカスがある場合は抑制する。
 */
export function useCtrlBadge() {
  const ctrlPressed = ref(false);
  const contextKeys = useContextKeys();

  useEventListener(document, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Control" && !contextKeys.get("inputFocused")) ctrlPressed.value = true;
  });
  useEventListener(document, "keyup", (e: KeyboardEvent) => {
    if (e.key === "Control") ctrlPressed.value = false;
  });
  // ウィンドウからフォーカスが外れた場合にリセット
  useEventListener(window, "blur", () => {
    ctrlPressed.value = false;
  });
  // Ctrl 押下中に editable 要素にフォーカスが移った場合にリセット
  useEventListener(document, "focusin", () => {
    if (ctrlPressed.value && contextKeys.get("inputFocused")) ctrlPressed.value = false;
  });

  return { ctrlPressed };
}
