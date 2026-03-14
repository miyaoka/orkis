/** ターミナル共通設定。ghostty-web / xterm.js 両バックエンドで共有する。 */

export const TERMINAL_FONT_SIZE = 13;

// 日本語等幅フォント（HackGen, PlemolJP）を英字フォントの後に配置する。
// xterm.js は半角セル幅 × 2 で全角文字を描画するため、
// 日本語グリフの幅が英字フォント幅の2倍に合う等幅フォントが必要。
export const TERMINAL_FONT_FAMILY = [
  "'JetBrainsMono Nerd Font'",
  "'JetBrains Mono'",
  "'FiraCode Nerd Font'",
  "'Fira Code'",
  "HackGen",
  "'HackGen Console NF'",
  "PlemolJP",
  "'PlemolJP Console NF'",
  "'Osaka-Mono'",
  "Menlo",
  "monospace",
].join(", ");

export const TERMINAL_THEME = {
  background: "#18181b", // zinc-900
  foreground: "#e4e4e7", // zinc-200
  cursor: "#e4e4e7",
};
