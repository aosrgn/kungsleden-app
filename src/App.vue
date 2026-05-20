<script setup lang="ts">
const sha = __COMMIT_SHA__
const buildTime = __BUILD_TIME__
</script>

<template>
  <main>
    <h1>Kungsleden Planning</h1>
    <p class="tag">Hemavan → Abisko, Aug 2026</p>
    <div class="marker">🥾</div>
    <p class="tag">Vue + Vite + PWA scaffold ✓</p>
  </main>
  <footer>
    build <code>{{ sha }}</code> · <code>{{ buildTime }}</code>
  </footer>
</template>

<style scoped>
main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

h1 {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  margin: 0 0 0.5rem;
  letter-spacing: -0.02em;
}

.tag {
  opacity: 0.6;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.marker {
  margin-top: 1.5rem;
  font-size: 3rem;
}

footer {
  padding: 1rem;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  opacity: 0.5;
  border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}

footer code {
  font-family: inherit;
}
</style>
