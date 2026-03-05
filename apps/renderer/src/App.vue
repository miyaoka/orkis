<script setup lang="ts">
const ipcHandle = () => window.api.ping()
</script>

<template>
  <div>
    <h1>orkis</h1>
    <p>AI Agent Orchestrator</p>
    <button @click="ipcHandle">Send IPC ping</button>
  </div>
</template>
