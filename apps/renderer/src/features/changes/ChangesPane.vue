<doc lang="md">
Changed files list. Shows HEAD vs working directory by default, or a selected commit's changes from the git graph.
</doc>

<script setup lang="ts"></script>

<template>
  <div
    class="flex size-full flex-col overflow-hidden border-l border-zinc-700 bg-zinc-900 text-zinc-300"
  >
    <div class="flex shrink-0 items-center gap-1.5 border-b border-zinc-700 px-3 py-1.5">
      <span class="icon-[lucide--git-branch] size-4 text-zinc-400" />
      <span class="text-xs font-semibold text-zinc-400">Changes</span>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs text-zinc-500">No changes</div>
    </div>
  </div>
</template>
