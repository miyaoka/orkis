<script setup lang="ts">
defineProps<{
  content: string;
}>();

const DIFF_LINE_CLASSES: Record<string, string> = {
  "+++": "text-zinc-500",
  "---": "text-zinc-500",
  "@@": "text-cyan-400",
  "+": "text-green-400 bg-green-400/10",
  "-": "text-red-400 bg-red-400/10",
};

function diffLineClass(line: string): string {
  for (const [prefix, cls] of Object.entries(DIFF_LINE_CLASSES)) {
    if (line.startsWith(prefix)) return cls;
  }
  return "text-zinc-300";
}
</script>

<template>
  <pre class="line-numbered p-4 text-sm/tight"><span
      v-for="(line, i) in content.split('\n')"
      :key="i"
      class="line"
      :class="diffLineClass(line)"
      :data-line="i + 1"
    >{{ line }}
</span></pre>
</template>

<style scoped>
.line-numbered .line {
  display: block;
}

.line-numbered .line::before {
  content: attr(data-line);
  display: inline-block;
  width: 3ch;
  margin-right: 1.5ch;
  text-align: right;
  color: var(--color-zinc-600);
  user-select: none;
}
</style>
