import path from "node:path";
import { docBlockPlugin } from "@miyaoka/vite-plugin-doc-block";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const isNative = !!process.env.GOZD_NATIVE;

export default defineConfig({
  plugins: [docBlockPlugin(), tailwindcss(), vue()],
  base: "./",
  build: {
    outDir: "dist",
    // material-icon-theme の SVG（1200+個）がインライン化されて JS が肥大化するのを防ぐ
    assetsInlineLimit: 0,
    // node:fs 等の Node.js モジュールを空モジュールに置き換え、別チャンクとして出力させない
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
  resolve: {
    alias: isNative
      ? {
          // native モード: electrobun/view を gozd-rpc:// ベースのシムに差し替え
          "electrobun/view": path.resolve(__dirname, "src/shared/rpc/electrobunShim.ts"),
        }
      : {},
  },
  // electrobun/view はソース TS を直接 export しており、内部で .js 拡張子の import を使っている
  // node_modules 内の TS ファイルを Vite が正しく処理するために optimizeDeps に含める
  optimizeDeps: {
    include: isNative ? [] : ["electrobun/view"],
  },
});
