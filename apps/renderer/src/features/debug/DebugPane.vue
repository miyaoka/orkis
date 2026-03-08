<script setup lang="ts">
import { computed } from "vue";
import { useGitStatus } from "../filer/useGitStatus";
import { useWorkspace } from "../filer/useWorkspace";

const mode = import.meta.env.DEV ? "dev" : "build";
const { dir, file } = useWorkspace();
const { gitStatuses } = useGitStatus();

interface GitStatusEntry {
  filePath: string;
  status: string;
}

/** index 側（X）にステータスがあれば staged */
function isStaged(status: string): boolean {
  return status[0] !== " " && status[0] !== "?";
}

const stagedEntries = computed<GitStatusEntry[]>(() =>
  Object.entries(gitStatuses.value)
    .filter(([, status]) => isStaged(status))
    .map(([filePath, status]) => ({ filePath, status })),
);

const unstagedEntries = computed<GitStatusEntry[]>(() =>
  Object.entries(gitStatuses.value)
    .filter(([, status]) => !isStaged(status))
    .map(([filePath, status]) => ({ filePath, status })),
);
</script>

<template>
  <div class="rounded-sm border border-zinc-700 bg-zinc-800 p-3 font-mono text-sm text-zinc-300">
    <div class="mb-1 flex items-center gap-2 font-bold text-zinc-400">
      <span class="icon-[lucide--bug]" />
      Debug
      <span
        v-if="mode"
        class="rounded-sm bg-zinc-700 px-1.5 py-0.5 text-xs"
        :class="mode === 'dev' ? 'text-green-400' : 'text-blue-400'"
      >
        {{ mode }}
      </span>
    </div>
    <template v-if="dir">
      <div>dir: {{ dir }}</div>
      <div v-if="file">file: {{ file }}</div>

      <!-- git status -->
      <div class="mt-2 border-t border-zinc-700 pt-2">
        <div
          v-if="stagedEntries.length === 0 && unstagedEntries.length === 0"
          class="text-zinc-500"
        >
          clean
        </div>
        <template v-else>
          <template v-if="stagedEntries.length > 0">
            <div class="mb-0.5 text-zinc-400">staged ({{ stagedEntries.length }})</div>
            <div
              v-for="entry in stagedEntries"
              :key="entry.filePath"
              class="truncate text-xs text-green-400"
            >
              <span class="text-zinc-500">{{ entry.status[0] }}</span>
              {{ entry.filePath }}
            </div>
          </template>
          <template v-if="unstagedEntries.length > 0">
            <div class="mt-1 mb-0.5 text-zinc-400">unstaged ({{ unstagedEntries.length }})</div>
            <div
              v-for="entry in unstagedEntries"
              :key="entry.filePath"
              class="truncate text-xs text-yellow-400"
            >
              <span class="text-zinc-500">{{ entry.status === "??" ? "?" : entry.status[1] }}</span>
              {{ entry.filePath }}
            </div>
          </template>
        </template>
      </div>
    </template>
    <div v-else class="text-zinc-500">waiting for open command...</div>
  </div>
</template>
