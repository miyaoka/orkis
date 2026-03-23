export { convertTheme } from "./convertTheme";
export type { XtermTheme } from "./convertTheme";

/**
 * vendor/ 内の全テーマ JSON を Vite の import.meta.glob で遅延ロード可能にする。
 * 実際のグロブ展開は renderer 側で行う（packages 内では import.meta.glob が使えないため）。
 * このパッケージはテーマ名一覧の取得と変換ロジックを提供する。
 */
