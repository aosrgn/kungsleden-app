<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Registers the service worker and tracks whether a newer build is waiting.
// With registerType 'prompt' the new SW downloads but stays in 'waiting' until
// updateServiceWorker(true) activates it and reloads — the Update button below.
const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })
</script>

<template>
  <div v-if="needRefresh" class="update">
    <span>New version ready</span>
    <button @click="updateServiceWorker(true)">Update</button>
  </div>
</template>

<style scoped>
.update {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0) + 0.75rem);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.5rem 0.5rem 0.9rem;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 2rem;
  font-size: 0.85rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 2000;
}

.update button {
  padding: 0.35rem 0.8rem;
  border: none;
  background: #f4f1ea;
  color: #0a3d2e;
  border-radius: 1.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
