/**
 * テーマ選択コマンド。
 * コマンドパレットから "Terminal: Select Theme" を実行すると QuickPick が開き、
 * テーマ名のフォーカスでリアルタイムプレビュー、Enter で確定保存、Escape でロールバックする。
 */

import { tryCatch } from "@gozd/shared";
import { darkThemeNames, lightThemeNames, loadTheme } from "@gozd/themes";
import { useCommandRegistry } from "../../shared/command";
import { useQuickPick } from "../../shared/quick-pick";
import type { QuickPickItem } from "../../shared/quick-pick";
import { useRpc } from "../../shared/rpc";
import { currentTheme } from "./terminalConfig";

/** 起動時に保存済みテーマを復元する */
async function restoreSavedTheme(
  configLoad: () => Promise<{ terminalTheme?: string }>,
): Promise<void> {
  const result = await tryCatch(configLoad());
  if (!result.ok) return;
  const { terminalTheme } = result.value;
  if (terminalTheme === undefined) return;
  const theme = await loadTheme(terminalTheme);
  if (theme !== undefined) {
    currentTheme.value = theme;
  }
}

export function registerThemeCommand(): () => void {
  const registry = useCommandRegistry();
  const { show } = useQuickPick();
  const { request } = useRpc();

  // 起動時にテーマを復元
  void restoreSavedTheme(() => request.configLoad());

  const dispose = registry.register("terminal.selectTheme", {
    label: "Terminal: Select Theme",
    handler: () => {
      const previousTheme = { ...currentTheme.value };

      // 非同期ロードの競合を防止する世代トークン。
      // 新しいリクエストが発行されるたびにインクリメントし、
      // 完了時にトークンが最新でなければ結果を破棄する。
      let generation = 0;

      const items: QuickPickItem[] = [
        { label: "Dark", separator: true },
        ...darkThemeNames.map((name) => ({ label: name })),
        { label: "Light", separator: true },
        ...lightThemeNames.map((name) => ({ label: name })),
      ];

      show({
        items,
        placeholder: "Select a terminal theme...",
        onHighlight: (item) => {
          const gen = ++generation;
          void loadTheme(item.label).then((theme) => {
            if (gen !== generation) return;
            if (theme !== undefined) {
              currentTheme.value = theme;
            }
          });
        },
        onAccept: (item) => {
          const gen = ++generation;
          void loadTheme(item.label).then((theme) => {
            if (gen !== generation) return;
            if (theme !== undefined) {
              currentTheme.value = theme;
              void request.configSave({ terminalTheme: item.label });
            }
          });
        },
        onCancel: () => {
          generation++;
          currentTheme.value = previousTheme;
        },
      });

      return true;
    },
  });

  return dispose;
}
