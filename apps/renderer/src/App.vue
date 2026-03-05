<script setup lang="ts">
import TerminalPane from "./components/TerminalPane.vue";
</script>

<template>
  <div class="flex h-screen bg-zinc-900 text-white">
    <!-- 左ペイン -->
    <div class="flex w-80 shrink-0 flex-col border-r border-zinc-700 p-4">
      <h1 class="mb-4 text-lg font-bold">
        <span class="mr-2 icon-[lucide--bot] align-middle text-blue-400" />
        orkis
      </h1>
      <p class="text-sm text-zinc-400">Todos (coming soon)</p>
    </div>

    <!-- 右ペイン: ターミナル -->
    <div class="min-w-0 flex-1 p-2">
      <TerminalPane />
    </div>
  </div>
</template>
