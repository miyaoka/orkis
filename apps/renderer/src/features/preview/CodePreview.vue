<doc lang="md">
Shiki によるシンタックスハイライト付きコード表示。

- 非同期ハイライト完了までは行番号付きプレーンテキストをフォールバック表示
- バージョンカウンターで非同期レースを防止
</doc>

<script setup lang="ts">
import { watch, ref } from "vue";
import { highlight } from "./useHighlight";

const props = defineProps<{
  content: string;
  filePath: string;
  wordWrap: boolean;
}>();

const highlightedHtml = ref<string>();

/** 非同期レース防止用のバージョンカウンター */
let highlightVersion = 0;

watch(
  () => [props.content, props.filePath],
  () => {
    highlightedHtml.value = undefined;
    const version = ++highlightVersion;
    highlight(props.content, props.filePath).then((html) => {
      if (version === highlightVersion && html) highlightedHtml.value = html;
    });
  },
  { immediate: true },
);
</script>

<template>
  <!-- ハイライト済み HTML -->
  <div
    v-if="highlightedHtml"
    class="_highlighted-code text-sm/tight"
    :class="wordWrap ? '_word-wrap' : ''"
    v-html="highlightedHtml"
  />

  <!-- フォールバック: プレーンテキスト -->
  <pre
    v-else
    class="_line-numbered p-4 text-sm/tight text-zinc-300"
    :class="wordWrap ? '_word-wrap break-all whitespace-pre-wrap' : ''"
  ><code><span
        v-for="(line, i) in content.split('\n')"
        :key="i"
        class="_line"
        :data-line="i + 1"
      >{{ line }}
</span></code></pre>
</template>

<style scoped>
._line-numbered ._line::before,
._highlighted-code :deep(.line::before) {
  content: attr(data-line);
  display: inline-block;
  width: 3ch;
  margin-right: 1.5ch;
  text-align: right;
  color: var(--color-zinc-600);
  user-select: none;
}

/* 折り返し時: 行番号を absolute で固定し、折り返し行が行番号の右側に揃うよう padding で確保 */
._line-numbered._word-wrap ._line,
._highlighted-code._word-wrap :deep(.line) {
  position: relative;
  display: block;
  padding-left: 4.5ch;
  min-height: 1lh;
}

._line-numbered._word-wrap ._line::before,
._highlighted-code._word-wrap :deep(.line::before) {
  position: absolute;
  left: 0;
  margin-right: 0;
}

._highlighted-code :deep(pre) {
  padding: 1rem;
  margin: 0;
  background: transparent !important;
}

._highlighted-code._word-wrap :deep(pre) {
  white-space: pre-wrap;
  word-break: break-all;
}

._highlighted-code :deep(code) {
  font-family: inherit;
}

._highlighted-code._word-wrap :deep(code) {
  display: flex;
  flex-direction: column;
}
</style>
