<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Hands the regenerated field map to the phone. iOS renders a fetched .gpx inline rather
// than downloading it, so the share sheet is the only route that lands the file in
// Garmin/Footpath/Guru — with an <a download> fallback where Web Share can't take files.
const GPX_URL = `${import.meta.env.BASE_URL}data/kungsleden.gpx`
const FILE_NAME = 'kungsleden.gpx'

const state = ref<'idle' | 'working' | 'done' | 'error'>('idle')
const detail = ref('')

// Fetched up front (it's precached, so this is a cache hit) so the click can call share()
// straight away — awaiting a fetch first can burn the transient user activation iOS needs.
let file: File | null = null

async function fetchFile(): Promise<File> {
  const res = await fetch(GPX_URL)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  const blob = await res.blob()
  return new File([blob], FILE_NAME, { type: 'application/gpx+xml' })
}

// A miss here is silent — exportGpx() refetches (and surfaces the error) on demand.
onMounted(() => {
  fetchFile().then((f) => (file = f)).catch(() => {})
})

function fallbackDownload(f: File) {
  const url = URL.createObjectURL(f)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function exportGpx() {
  state.value = 'working'
  detail.value = ''
  try {
    const f = file ?? (await fetchFile())
    file = f
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f], title: 'Kungsleden field map' })
    } else {
      fallbackDownload(f)
    }
    state.value = 'done'
  } catch (e) {
    // Dismissing the share sheet is a normal outcome, not a failure.
    if ((e as Error).name === 'AbortError') {
      state.value = 'idle'
      return
    }
    state.value = 'error'
    detail.value = (e as Error).message
  }
}
</script>

<template>
  <section class="gpx">
    <button :disabled="state === 'working'" @click="exportGpx">
      {{ state === 'working' ? 'preparing…' : 'Export field GPX' }}
    </button>
    <span v-if="state === 'done'" class="note">sent — open in your nav app</span>
    <span v-else-if="state === 'error'" class="note err">failed: {{ detail }}</span>
    <span v-else class="note">share into Garmin · Footpath · Guru</span>
  </section>
</template>

<style scoped>
.gpx {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.7rem 0.9rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.gpx button {
  padding: 0.35rem 0.65rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 0.35rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.gpx button:disabled { opacity: 0.6; cursor: default; }
.note { font-size: 0.75rem; opacity: 0.65; }
.note.err { color: #c2410c; opacity: 1; }
</style>
