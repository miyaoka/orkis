/**
 * テーマ名からテーマ JSON を遅延ロードし、XtermTheme に変換して返す。
 * unsafe cast をパッケージ内に閉じ込め、呼び出し側は型安全な XtermTheme のみを扱う。
 */

import { convertTheme } from "./convertTheme";
import type { WindowsTerminalTheme } from "./convertTheme";
import type { XtermTheme } from "./convertTheme";
import { themeLoaders } from "../dist/themeLoaders";

export async function loadTheme(name: string): Promise<XtermTheme | undefined> {
  const loader = themeLoaders[name];
  if (loader === undefined) return undefined;
  const mod = await loader();
  return convertTheme(mod.default as WindowsTerminalTheme);
}
