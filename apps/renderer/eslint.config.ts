import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import { baseRules } from "./eslint.base";

export default defineConfigWithVueTs(
  // ignores 設定
  { ignores: ["dist/**", "node_modules/**"] },

  // Vue 推奨設定
  pluginVue.configs["flat/essential"],

  // TypeScript 設定（Vue 用、tseslint.configs.recommended の代わり）
  vueTsConfigs.recommended,

  // 共有ルール（推奨設定より後に配置し、カスタムルールを優先）
  baseRules,

  // tsconfigRootDir: モノレポで複数の tsconfig.json が存在する場合、
  // このパッケージの tsconfig.json を使用するよう明示的に指定
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // フォーマット系ルール無効化（最後に配置）
  skipFormatting,
);
