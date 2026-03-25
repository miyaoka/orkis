<doc lang="md">
文字列設定用テキスト入力。
</doc>

<script setup lang="ts">
import type { StringSetting } from "../types";

const props = defineProps<{
  setting: StringSetting;
}>();

const model = defineModel<string>({ required: true });
</script>

<template>
  <input
    type="text"
    :value="model"
    :placeholder="props.setting.placeholder"
    class="w-56 rounded-sm border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
    @change="model = ($event.target as HTMLInputElement).value"
  />
</template>
