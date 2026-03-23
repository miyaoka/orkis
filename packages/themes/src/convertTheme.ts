/**
 * Windows Terminal 形式のテーマ JSON を xterm.js の ITheme 互換オブジェクトに変換する。
 *
 * 差分:
 * - purple / brightPurple → magenta / brightMagenta
 * - cursorColor → cursor
 * - name フィールドを除去
 */

interface WindowsTerminalTheme {
  name: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightPurple: string;
  brightCyan: string;
  brightWhite: string;
  background: string;
  foreground: string;
  cursorColor: string;
  selectionBackground: string;
}

export interface XtermTheme {
  foreground: string;
  background: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export function convertTheme(wt: WindowsTerminalTheme): XtermTheme {
  return {
    foreground: wt.foreground,
    background: wt.background,
    cursor: wt.cursorColor,
    selectionBackground: wt.selectionBackground,
    black: wt.black,
    red: wt.red,
    green: wt.green,
    yellow: wt.yellow,
    blue: wt.blue,
    magenta: wt.purple,
    cyan: wt.cyan,
    white: wt.white,
    brightBlack: wt.brightBlack,
    brightRed: wt.brightRed,
    brightGreen: wt.brightGreen,
    brightYellow: wt.brightYellow,
    brightBlue: wt.brightBlue,
    brightMagenta: wt.brightPurple,
    brightCyan: wt.brightCyan,
    brightWhite: wt.brightWhite,
  };
}
