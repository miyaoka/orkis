<doc lang="md">
左端のサイドバー。プロジェクトの worktree 一覧とブランチ一覧を表示する。

## 操作

- worktree の x: 解除（まず通常削除を試行、未コミット変更がある場合は確認後 --force）
- ブランチの x: 確認ダイアログ後にブランチ削除
- ブランチクリック: そのブランチで worktree を作成
- New worktree: 新規一時ブランチで worktree を作成
</doc>

<script setup lang="ts">
import type { WorktreeEntry } from "@orkis/rpc";
import { tryCatch } from "@orkis/shared";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useWorkspaceStore } from "../filer/useWorkspaceStore";
import { useRpc } from "../rpc/useRpc";

const workspaceStore = useWorkspaceStore();
const { request, onGitStatusChange } = useRpc();

const worktrees = ref<WorktreeEntry[]>([]);
/** worktree 化されていないローカルブランチ */
const freeBranches = ref<string[]>([]);
const isCreating = ref(false);

/** ダイアログの状態 */
const dialogRef = ref<HTMLDialogElement>();
const dialogMessage = ref("");
const dialogAction = ref<(() => Promise<void>) | undefined>();

function showDialog(message: string, action: () => Promise<void>) {
  dialogMessage.value = message;
  dialogAction.value = action;
  dialogRef.value?.showModal();
}

function closeDialog() {
  dialogRef.value?.close();
  dialogAction.value = undefined;
}

async function executeDialogAction() {
  const action = dialogAction.value;
  if (!action) return;
  closeDialog();
  await action();
}

async function fetchData() {
  if (!workspaceStore.dir) return;
  const [wtList, branchList] = await Promise.all([
    request.gitWorktreeList(),
    request.gitBranchList(),
  ]);
  worktrees.value = wtList;
  const wtBranches = new Set(wtList.map((wt) => wt.branch).filter(Boolean));
  freeBranches.value = branchList.filter((b) => !wtBranches.has(b));
}

async function addWorktree(branch?: string) {
  isCreating.value = true;
  const entry = await request.gitWorktreeAdd({ branch });
  worktrees.value.push(entry);
  if (branch) {
    freeBranches.value = freeBranches.value.filter((b) => b !== branch);
  }
  isCreating.value = false;
}

function removeFromList(wtPath: string) {
  worktrees.value = worktrees.value.filter((w) => w.path !== wtPath);
}

/** worktree 解除: まず通常削除、失敗したら確認後 --force */
async function handleWorktreeRemove(wt: WorktreeEntry) {
  const result = await tryCatch(request.gitWorktreeRemove({ path: wt.path }));
  if (result.ok) {
    removeFromList(wt.path);
    return;
  }
  // 未コミット変更がある場合
  showDialog(`"${wt.branch}" に未コミットの変更があります。強制的に解除しますか？`, async () => {
    await request.gitWorktreeRemove({ path: wt.path, force: true });
    removeFromList(wt.path);
  });
}

/** ブランチ削除: 確認ダイアログ */
function handleBranchDelete(branch: string) {
  showDialog(`ブランチ "${branch}" を削除しますか？`, async () => {
    await request.gitBranchDelete({ branch });
    freeBranches.value = freeBranches.value.filter((b) => b !== branch);
  });
}

watch(() => workspaceStore.dir, fetchData, { immediate: true });

let cleanup: (() => void) | undefined;
onMounted(() => {
  cleanup = onGitStatusChange(() => fetchData());
});
onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <div class="flex size-full flex-col p-4">
    <h1 class="mb-4 text-lg font-bold">
      <span class="mr-2 icon-[lucide--bot] align-middle text-blue-400" />
      orkis
    </h1>

    <div class="flex flex-col">
      <h2 class="mb-1 text-xs font-medium text-zinc-500">WORKTREES</h2>

      <div
        v-for="wt in worktrees"
        :key="wt.path"
        class="group/wt flex items-center rounded-sm text-left hover:bg-zinc-800"
      >
        <button class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2">
          <span
            class="shrink-0 text-base"
            :class="
              wt.isMain
                ? 'icon-[lucide--home] text-zinc-500'
                : 'icon-[lucide--git-branch] text-zinc-400'
            "
          />
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-sm" :class="wt.isMain ? 'text-zinc-400' : 'text-zinc-200'">
              {{ wt.branch ?? "(detached)" }}
            </span>
            <span class="font-mono text-xs text-zinc-600">{{ wt.head }}</span>
          </div>
        </button>

        <span v-if="wt.isMain" class="shrink-0 pr-2 text-xs text-zinc-600">ref</span>
        <button
          v-if="!wt.isMain"
          class="grid size-10 shrink-0 place-items-center text-zinc-600 opacity-0 transition-opacity group-hover/wt:opacity-100 hover:text-red-400"
          @click.stop="handleWorktreeRemove(wt)"
        >
          <span class="icon-[lucide--unlink] text-sm" />
        </button>
      </div>

      <p v-if="worktrees.length === 0" class="py-2 pl-2 text-sm text-zinc-500">読み込み中...</p>

      <button
        class="mt-1 flex items-center gap-2 rounded-sm py-1.5 pl-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        :disabled="isCreating"
        @click="addWorktree()"
      >
        <span class="icon-[lucide--plus] text-base" />
        {{ isCreating ? "作成中..." : "New worktree" }}
      </button>
    </div>

    <div v-if="freeBranches.length > 0" class="mt-4 flex flex-col">
      <h2 class="mb-1 text-xs font-medium text-zinc-500">BRANCHES</h2>

      <div
        v-for="branch in freeBranches"
        :key="branch"
        class="group/br flex items-center rounded-sm hover:bg-zinc-800"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-sm text-zinc-500">
          <span class="icon-[lucide--git-branch] shrink-0 text-base" />
          <span class="truncate">{{ branch }}</span>
        </div>
        <button
          class="grid size-10 shrink-0 place-items-center text-zinc-600 opacity-0 transition-opacity group-hover/br:opacity-100 hover:text-zinc-300"
          :disabled="isCreating"
          @click.stop="addWorktree(branch)"
        >
          <span class="icon-[lucide--link] text-sm" />
        </button>
      </div>
    </div>

    <dialog
      ref="dialogRef"
      class="fixed inset-0 m-auto size-fit rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-white backdrop:bg-black/50"
      @click="$event.target === dialogRef && closeDialog()"
    >
      <p class="mb-4 text-sm">{{ dialogMessage }}</p>
      <div class="flex justify-end gap-2">
        <button
          class="rounded-sm px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
          @click="closeDialog"
        >
          キャンセル
        </button>
        <button
          class="rounded-sm bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
          @click="executeDialogAction"
        >
          削除
        </button>
      </div>
    </dialog>
  </div>
</template>
