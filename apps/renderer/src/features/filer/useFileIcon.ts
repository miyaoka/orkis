import { generateManifest } from "material-icon-theme";

/**
 * material-icon-theme のマニフェストから統合アイコンマッピングを構築する。
 * 解決優先順位: fileNames → fileExtensions → languageIds → デフォルト
 */

const manifest = generateManifest();

/** SVG を URL として一括取り込み（Vite がビルド時にハッシュ付きパスに変換） */
const svgModules = import.meta.glob<string>("/node_modules/material-icon-theme/icons/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
  exhaustive: true,
});

/** アイコン名 → SVG URL のマップ */
const iconUrlMap = new Map<string, string>();
for (const [path, url] of Object.entries(svgModules)) {
  // "/node_modules/material-icon-theme/icons/typescript.svg" → "typescript"
  const match = path.match(/\/([^/]+)\.svg$/);
  if (match?.[1]) {
    iconUrlMap.set(match[1], url);
  }
}

/** ファイル名（小文字） → アイコン名 */
const fileNameMap = new Map<string, string>();
for (const [name, icon] of Object.entries(manifest.fileNames ?? {})) {
  fileNameMap.set(name.toLowerCase(), icon);
}

/** 拡張子 → アイコン名 */
const fileExtensionMap = new Map<string, string>();
for (const [ext, icon] of Object.entries(manifest.fileExtensions ?? {})) {
  fileExtensionMap.set(ext, icon);
}

/**
 * 拡張子 → VS Code 言語 ID のマッピング。
 * languageIds は VS Code の言語 ID がキーだが、ファイラーでは拡張子しかわからないため
 * 拡張子 → 言語 ID → アイコン名 の変換が必要。
 */
const EXTENSION_LANGUAGE_ID_MAP: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascriptreact",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  fs: "fsharp",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  ps1: "powershell",
  r: "r",
  lua: "lua",
  dart: "dart",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  clj: "clojure",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "sml",
  nim: "nim",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  proto: "proto",
  svelte: "svelte",
  vue: "vue",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sass: "sass",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "svg",
  md: "markdown",
  tex: "tex",
  pdf: "pdf",
  diff: "diff",
  log: "log",
};

const languageIdMap = new Map<string, string>();
for (const [langId, icon] of Object.entries(manifest.languageIds ?? {})) {
  languageIdMap.set(langId, icon);
}

const DEFAULT_FILE_ICON = manifest.file ?? "file";
const DEFAULT_FOLDER_ICON = manifest.folder ?? "folder";
const DEFAULT_FOLDER_OPEN_ICON = manifest.folderExpanded ?? "folder-open";

/** フォルダ名（小文字） → アイコン名 */
const folderNameMap = new Map<string, string>();
for (const [name, icon] of Object.entries(manifest.folderNames ?? {})) {
  folderNameMap.set(name.toLowerCase(), icon);
}

const folderNameOpenMap = new Map<string, string>();
for (const [name, icon] of Object.entries(manifest.folderNamesExpanded ?? {})) {
  folderNameOpenMap.set(name.toLowerCase(), icon);
}

/** ファイル名からアイコン名を解決する */
function getFileIconName(fileName: string): string {
  const lower = fileName.toLowerCase();

  // ファイル名完全一致
  const byName = fileNameMap.get(lower);
  if (byName) return byName;

  // 拡張子マッチ（複合拡張子も対応: .test.ts → test.ts → ts）
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    const byExt = fileExtensionMap.get(ext);
    if (byExt) return byExt;
  }

  // 拡張子 → 言語ID → アイコン名
  const ext = parts[parts.length - 1];
  if (ext) {
    const langId = EXTENSION_LANGUAGE_ID_MAP[ext];
    if (langId) {
      const byLang = languageIdMap.get(langId);
      if (byLang) return byLang;
    }
  }

  return DEFAULT_FILE_ICON;
}

/** フォルダ名からアイコン名を解決する */
function getFolderIconName(folderName: string, isOpen: boolean): string {
  const lower = folderName.toLowerCase();
  if (isOpen) {
    return folderNameOpenMap.get(lower) ?? DEFAULT_FOLDER_OPEN_ICON;
  }
  return folderNameMap.get(lower) ?? DEFAULT_FOLDER_ICON;
}

/** アイコン名から SVG の URL を返す */
function getIconUrl(iconName: string): string | undefined {
  return iconUrlMap.get(iconName);
}

export { getFileIconName, getFolderIconName, getIconUrl };
