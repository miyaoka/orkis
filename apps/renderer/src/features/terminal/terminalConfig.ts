/**
 * ターミナル共通設定。
 * theme・font はリアクティブで、設定変更時にリアルタイム反映される。
 */

import type { XtermTheme } from "@gozd/themes";
import { ref } from "vue";

/** xterm.js に未指定時のデフォルトテーマカラー */
const DEFAULT_THEME: Partial<XtermTheme> = {
  background: "#18181b",
  foreground: "#e4e4e7",
  cursor: "#e4e4e7",
};

const SCROLLBACK = 10000;

/** スクロールバック行数 */
export const terminalScrollback = SCROLLBACK;

/** リアクティブなフォント設定。空文字 / 0 は未設定（xterm デフォルトに委ねる） */
export const terminalFontFamily = ref("");
export const terminalFontSize = ref(0);

/**
 * 現在のターミナルテーマ。watch で全 xterm インスタンスに反映される。
 * 未指定のプロパティは xterm.js のデフォルト値が使われる。
 */
export const currentTheme = ref<Partial<XtermTheme>>(DEFAULT_THEME);

/** 現在適用中のテーマ名。未選択（デフォルト）の場合は undefined */
export const currentThemeName = ref<string>();
