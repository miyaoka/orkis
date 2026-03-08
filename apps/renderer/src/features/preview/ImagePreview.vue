<script setup lang="ts">
defineProps<{
  /** 画像の data: URL */
  src: string;
}>();
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4">
    <img :src="src" class="max-h-full max-w-full object-contain" alt="" />
  </div>
</template>
