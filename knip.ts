import type { KnipConfig } from "knip";

const config: KnipConfig = {
  // macOS の open コマンド、pnpm -r で呼ぶワークスペースの scripts 名
  // eslint: lefthook.yml で pnpm exec eslint として使用（renderer の devDep）
  // open: macOS の /usr/bin/open コマンド
  // typecheck: pnpm -r で呼ぶワークスペースの scripts 名
  ignoreBinaries: ["eslint", "open", "typecheck"],
  workspaces: {
    ".": {},
    "apps/cli": {
      // @miyaoka/fsss が commandsDir から動的にコマンドを発見するため明示的に指定
      entry: ["src/commands/*.ts"],
    },
    "apps/desktop": {
      // electrobun.config.ts: Electrobun のビルド設定（knip が自動認識しないフレームワーク）
      // placeholder.ts: electrobun.config.ts の views entrypoint（文字列参照のため knip が追跡できない）
      entry: ["src/index.ts", "electrobun.config.ts", "src/placeholder.ts"],
      ignoreDependencies: [
        // build.copy で node_modules からファイルをコピーする（import ではない）
        "@gozd/cli",
        "@gozd/renderer",
      ],
    },
    "apps/renderer": {
      // electrobunShim.ts: GOZD_NATIVE 環境変数で Vite alias 経由で使用（静的 import なし）
      entry: ["src/shared/rpc/electrobunShim.ts!"],
      ignoreDependencies: [
        // @iconify/tailwind4 が動的に require する（packageExtensions で補完済み）
        "@iconify-json/lucide",
      ],
    },
    "packages/eslint-plugin": {},
    "packages/rpc": {},
    "packages/shared": {},
    "packages/themes": {},
  },
};

export default config;
