import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import type { ESLint } from "eslint";
import pluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import pluginBoundaries from "eslint-plugin-boundaries";
import pluginImportX from "eslint-plugin-import-x";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import pluginVue from "eslint-plugin-vue";

export default defineConfigWithVueTs(
  { ignores: ["dist/**", "node_modules/**"] },

  // Vue 推奨設定
  pluginVue.configs["flat/essential"],

  // TypeScript 設定（Vue 用、tseslint.configs.recommended の代わり）
  vueTsConfigs.recommended,

  // プラグイン + ルール
  {
    plugins: {
      // eslint-plugin-import-x の型が @typescript-eslint/utils の型を使用しており、
      // ESLint の defineConfig 型と互換性がない (typescript-eslint/typescript-eslint#11543)
      "import-x": pluginImportX as unknown as ESLint.Plugin,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      // unused-imports
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // import-x
      "import-x/no-duplicates": "warn",
      // 保存時の自動 lint で並び替えが発生すると編集中に邪魔なので off
      // lint:fix や pre-commit hook では eslint.config.fix.ts で有効化
      "import-x/order": [
        "off",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
          pathGroupsExcludedImportTypes: ["builtin", "external", "type"],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },

  // tsconfigRootDir: モノレポで複数の tsconfig.json が存在する場合、
  // このパッケージの tsconfig.json を使用するよう明示的に指定
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Tailwind 設定
  {
    ...pluginBetterTailwindcss.configs.recommended,
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/assets/main.css",
      },
    },
  },
  {
    rules: {
      // 各ルールは独立したワーカーで Tailwind Design System をロードするため、
      // 有効なルール数に比例して初期化コストが増加する（1ルールあたり約1秒）
      "better-tailwindcss/no-unknown-classes": [
        "warn",
        {
          ignore: ["_.*"],
        },
      ],
      // 初回呼び出しで全クラスのシグネチャを計算するため重い
      // eslint.config.fix.ts で有効化
      "better-tailwindcss/enforce-canonical-classes": "off",
      // フォーマッタと競合するため off
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      // フォーマッタと競合するため off
      "better-tailwindcss/no-unnecessary-whitespace": "off",
    },
  },

  // boundaries: feature 外からの内部モジュール直接 import を禁止
  {
    plugins: {
      boundaries: pluginBoundaries,
    },
    settings: {
      // eslint-module-utils/resolve が TypeScript の拡張子なし import を解決するために必要
      "import/resolver": {
        typescript: {
          project: "./tsconfig.app.json",
        },
      },
      "boundaries/elements": [
        { type: "feature", pattern: "src/features/*", mode: "folder" },
        { type: "shared", pattern: "src/shared/*", mode: "folder" },
      ],
    },
    rules: {
      // feature / shared のバレルファイル強制と依存方向制御
      // checkInternals: true で内部依存もチェック対象にし、
      // ネストされた子 feature（features/ サブディレクトリ）の内部直接 import も禁止する
      // ルール順序は last-write-wins: 最後にマッチしたルールの結果が最終結果
      //
      // NG: feature 外 → 内部モジュール直接 import
      // NG: 親 feature 内 → 子 feature の内部モジュール直接 import（3階層目含む）
      // NG: 親 feature 内 → 子 feature のバレルでないファイル直接 import
      // NG: shared → feature
      // OK: feature 外 → バレル経由
      // OK: 親 feature 内 → 子 feature のバレル経由
      // OK: 親 feature 内 → 3 階層目の子 feature のバレル経由
      // OK: 同一 feature 内の通常ファイル参照
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          checkInternals: true,
          rules: [
            // 1. feature / shared への依存は原則として index.ts のみ許可
            {
              to: [{ type: "feature" }, { type: "shared" }],
              disallow: {
                to: { internalPath: "!index.ts" },
              },
            },
            // 2. shared 内の内部依存は自由（1 の禁止を上書き）
            {
              from: { type: "shared" },
              allow: {
                dependency: {
                  relationship: { to: "internal" },
                },
              },
            },
            // 3. feature 内の通常ファイル間 import は自由（features/ 配下を除く）
            {
              from: { type: "feature" },
              allow: {
                dependency: {
                  relationship: { to: "internal" },
                },
                to: { internalPath: "!features/**" },
              },
            },
            // 4. 子 feature 内のファイル同士の import は自由
            //    from の internalPath が features/X/ で始まるファイルから、
            //    同じ features/X/ 内のファイルへの import を許可する
            {
              from: { type: "feature", internalPath: "features/**" },
              allow: {
                dependency: {
                  relationship: { to: "internal" },
                },
              },
            },
            // 5. feature 内の子 feature へは index.ts 経由のみ許可
            {
              from: { type: "feature" },
              allow: {
                dependency: {
                  relationship: { to: "internal" },
                },
                to: { internalPath: "features/**/index.ts" },
              },
            },
            // 5. shared → feature は常に禁止（最後に置いて上書き）
            {
              from: { type: "shared" },
              disallow: {
                to: { type: "feature" },
              },
            },
          ],
        },
      ],
    },
  },

  // フォーマット系ルール無効化（最後に配置）
  skipFormatting,
);
