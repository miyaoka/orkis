import { defineCommand } from "@miyaoka/fsss";
import { resolve } from "node:path";
import { z } from "zod";
import { sendMessage } from "../socket-client";

export default defineCommand({
  description: "指定ディレクトリを orkis で開く",
  args: {
    path: {
      type: z.string(),
      description: "プロジェクトディレクトリのパス",
      positional: true,
      default: ".",
    },
  },
  async run({ args }) {
    const absolutePath = resolve(args.path);
    try {
      await sendMessage({ type: "open", path: absolutePath });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  },
});
