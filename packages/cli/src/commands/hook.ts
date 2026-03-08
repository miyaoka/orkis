import { defineCommand } from "@miyaoka/fsss";
import { z } from "zod";
import { sendMessage } from "../socket-client";

const HOOK_EVENTS = ["running", "done", "needs-input"] as const;

export default defineCommand({
  description: "Claude Code Hooks からのイベントを受け取る",
  args: {
    event: {
      type: z.enum(HOOK_EVENTS),
      description: "フックイベント名 (running | done | needs-input)",
      positional: true,
    },
  },
  async run({ args }) {
    // stdin から JSON を読み取る（Claude Code Hooks が渡す）
    const input = await Bun.stdin.text();
    const payload = input.trim() ? JSON.parse(input) : {};

    try {
      await sendMessage({ type: "hook", event: args.event, payload });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  },
});
