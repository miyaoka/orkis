<doc lang="md">
Issue picker の1行分。Issue 番号・タイトル・author・更新日時を色分け表示する。
</doc>

<script setup lang="ts">
import type { GitIssue } from "@gozd/rpc";
import { computed } from "vue";

const props = defineProps<{
  issue: GitIssue;
}>();

interface DateDisplay {
  text: string;
  color: string;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;

function formatRelativeDate(isoDate: string): DateDisplay {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < MINUTES_PER_HOUR) {
    return { text: `${minutes}m ago`, color: "text-green-400" };
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return { text: `${hours}hr ago`, color: "text-yellow-400" };
  }
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) {
    return { text: `${days}d ago`, color: "text-orange-400" };
  }
  if (days < DAYS_PER_MONTH) {
    const weeks = Math.floor(days / DAYS_PER_WEEK);
    return { text: `${weeks}w ago`, color: "text-zinc-400" };
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return { text: `${y}/${m}/${d}`, color: "text-zinc-500" };
}

const dateDisplay = computed(() => formatRelativeDate(props.issue.updatedAt));
</script>

<template>
  <span class="truncate text-green-400">#{{ issue.number }}</span>
  <span class="truncate">{{ issue.title }}</span>
  <span class="flex items-center gap-1 truncate text-zinc-400">
    <img
      v-if="issue.authorAvatarUrl !== ''"
      :src="issue.authorAvatarUrl"
      :alt="issue.author"
      class="size-5 shrink-0 rounded-full"
    />
    <span v-else class="icon-[lucide--user] size-5 shrink-0" />
    <span class="truncate">{{ issue.author }}</span>
  </span>
  <span class="truncate text-right" :class="dateDisplay.color">{{ dateDisplay.text }}</span>
</template>
