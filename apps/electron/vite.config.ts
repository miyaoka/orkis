import { defineConfig } from "vite";
import { builtinModules } from "node:module";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    outDir: "dist",
    rollupOptions: {
      external: [
        "electron",
        "@orkis/preload",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    minify: false,
  },
});
