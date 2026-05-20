<script setup lang="ts">
import MapView from './components/MapView.vue'
const sha = __COMMIT_SHA__
const buildTime = __BUILD_TIME__
</script>

<template>
  <MapView />
  <div class="build-badge">
    <code>{{ sha }}</code> · <code>{{ buildTime }}</code>
  </div>
</template>

<style scoped>
.build-badge {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  right: 0;
  margin: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: rgba(0, 0, 0, 0.55);
  color: #f4f1ea;
  border-radius: 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  z-index: 1000;
  pointer-events: none;
}
</style>
