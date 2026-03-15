<doc lang="md">
ターミナルペイン。xterm.js ベースのターミナルエミュレータを表示する。
</doc>

<script setup lang="ts">
import XtermTerminal from "./XtermTerminal.vue";

defineProps<{
  fitSuspended?: boolean;
}>();
</script>

<template>
  <div class="flex size-full flex-col">
    <div class="min-h-0 flex-1">
      <XtermTerminal :fit-suspended="fitSuspended" />
    </div>
  </div>
</template>
