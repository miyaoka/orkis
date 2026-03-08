<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const openedDir = ref<string>();
const openedFile = ref<string>();

let cleanup: (() => void) | undefined;

onMounted(() => {
  cleanup = window.api.onOpen((dir, file) => {
    openedDir.value = dir;
    openedFile.value = file;
  });
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <div class="rounded-sm border border-zinc-700 bg-zinc-800 p-3 font-mono text-sm text-zinc-300">
    <div class="mb-1 font-bold text-zinc-400">
      <span class="mr-1 icon-[lucide--bug] align-middle" />
      Debug
    </div>
    <template v-if="openedDir">
      <div>dir: {{ openedDir }}</div>
      <div v-if="openedFile">file: {{ openedFile }}</div>
    </template>
    <div v-else class="text-zinc-500">waiting for open command...</div>
  </div>
</template>
