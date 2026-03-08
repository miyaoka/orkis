<doc lang="md">
アプリケーションのルートコンポーネント。

## 責務

- RPC 経由で `orkisOpen` イベントを受信し、ワークスペース（ディレクトリ・ファイル）を設定する
- マウント時に `rendererReady` を送信してメインプロセスに準備完了を通知する
</doc>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useWorkspace } from "./features/filer/useWorkspace";
import MainLayout from "./features/layout/MainLayout.vue";
import { useRpc } from "./features/rpc/useRpc";

const { setOpen } = useWorkspace();
const { send, onOrkisOpen } = useRpc();

let cleanup: (() => void) | undefined;

onMounted(() => {
  cleanup = onOrkisOpen(({ dir, file, fileServerBaseUrl }) => {
    setOpen(dir, file, fileServerBaseUrl);
  });
  send.rendererReady();
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <MainLayout />
</template>
