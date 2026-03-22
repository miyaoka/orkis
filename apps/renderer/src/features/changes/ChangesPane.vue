<doc lang="md">
Changed files list. Shows HEAD vs working directory by default, or a selected commit's changes from the git graph.

## Behavior

- No commit selected: shows git status (uncommitted changes)
- Uncommitted commit selected: same as no selection (git status)
- Normal commit selected: fetches changed files via `gitCommitFiles` RPC
- Clicking a file emits `select` with the relative path
</doc>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRpc } from "../../shared/rpc";
import { getFileIconName, getIconUrl } from "../filer";
import { UNCOMMITTED_HASH, useGitGraphStore } from "../git-graph";
import type { GitChangeKind } from "../worktree";
import { useGitStatusStore, resolveGitChangeKind } from "../worktree";

const emit = defineEmits<{
  select: [relPath: string];
}>();

const { request } = useRpc();
const gitGraphStore = useGitGraphStore();
const gitStatusStore = useGitStatusStore();

/** コミット選択時に取得した変更ファイル一覧 */
const commitFiles = ref<Record<string, string>>({});
const loading = ref(false);

/** 未選択 or Uncommitted 選択時は git status を使う */
const isUncommittedMode = computed(
  () => gitGraphStore.selectedHash === null || gitGraphStore.selectedHash === UNCOMMITTED_HASH,
);

/** 表示するファイル一覧のソース */
const fileStatuses = computed(() =>
  isUncommittedMode.value ? gitStatusStore.gitStatuses : commitFiles.value,
);

/** パスでソート済みの [path, statusCode] ペア */
const sortedFiles = computed(() =>
  Object.entries(fileStatuses.value).sort(([a], [b]) => a.localeCompare(b)),
);

const fileCount = computed(() => sortedFiles.value.length);

/** ヘッダーに表示するラベル */
const headerLabel = computed(() => {
  if (isUncommittedMode.value) return "Uncommitted Changes";
  const hash = gitGraphStore.selectedHash;
  if (hash === null) return "Changes";
  return hash.slice(0, 7);
});

const GIT_CHANGE_COLOR_MAP: Record<GitChangeKind, string> = {
  modified: "text-yellow-400",
  added: "text-green-400",
  deleted: "text-red-400",
  untracked: "text-green-400",
  renamed: "text-blue-400",
};

const GIT_CHANGE_LABEL_MAP: Record<GitChangeKind, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  untracked: "U",
  renamed: "R",
};

function changeKindFor(statusCode: string): GitChangeKind {
  return resolveGitChangeKind(statusCode);
}

function colorFor(statusCode: string): string {
  return GIT_CHANGE_COLOR_MAP[changeKindFor(statusCode)];
}

function labelFor(statusCode: string): string {
  return GIT_CHANGE_LABEL_MAP[changeKindFor(statusCode)];
}

/** パスからファイル名部分を抽出 */
function fileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
}

/** パスからディレクトリ部分を抽出 */
function dirPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash === -1 ? "" : filePath.slice(0, lastSlash);
}

// コミット選択が変わったら変更ファイルを取得
watch(
  () => gitGraphStore.selectedHash,
  async (hash) => {
    if (hash === null || hash === UNCOMMITTED_HASH) {
      commitFiles.value = {};
      return;
    }
    loading.value = true;
    commitFiles.value = await request.gitCommitFiles({ hash });
    loading.value = false;
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="flex size-full flex-col overflow-hidden border-l border-zinc-700 bg-zinc-900 text-zinc-300"
  >
    <div class="flex shrink-0 items-center gap-1.5 border-b border-zinc-700 px-3 py-1.5">
      <span class="icon-[lucide--git-branch] size-4 text-zinc-400" />
      <span class="text-xs font-semibold text-zinc-400">Changes</span>
      <span v-if="fileCount > 0" class="text-xs text-zinc-500">({{ fileCount }})</span>
      <span class="ml-auto text-xs text-zinc-500">{{ headerLabel }}</span>
    </div>

    <div v-if="loading" class="flex-1 overflow-y-auto p-2">
      <div class="text-xs text-zinc-500">Loading...</div>
    </div>

    <div v-else-if="sortedFiles.length === 0" class="flex-1 overflow-y-auto p-2">
      <div class="text-xs text-zinc-500">No changes</div>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="[path, statusCode] in sortedFiles"
        :key="path"
        class="flex cursor-pointer items-center gap-1.5 px-3 py-0.5 text-xs hover:bg-zinc-800/60"
        @click="emit('select', path)"
      >
        <span
          class="w-4 shrink-0 text-center font-mono text-[10px] font-bold"
          :class="colorFor(statusCode)"
        >
          {{ labelFor(statusCode) }}
        </span>
        <img :src="getIconUrl(getFileIconName(fileName(path)))" class="size-4 shrink-0" alt="" />
        <span class="shrink-0" :class="colorFor(statusCode)">
          {{ fileName(path) }}
        </span>
        <span v-if="dirPath(path)" class="truncate text-zinc-600">
          {{ dirPath(path) }}
        </span>
      </div>
    </div>
  </div>
</template>
