<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useGeolocation } from '../composables/useGeolocation'
import { loadTrip, type Trip } from '../data/trip'

const { status, coords, lastError, permState, isStandalone, locate } = useGeolocation()

const trip = ref<Trip | null>(null)
const dataError = ref<string>('')
onMounted(async () => {
  try {
    trip.value = await loadTrip()
  } catch (e) {
    dataError.value = (e as Error).message
  }
})

const statusLabel: Record<typeof status.value, string> = {
  idle: '',
  locating: 'locating…',
  located: 'located',
  denied: 'location denied',
  unavailable: 'geolocation unavailable',
  error: 'location error',
}
</script>

<template>
  <main class="planner">
    <header class="head">
      <strong>Kungsleden</strong>
      <span class="status">{{ statusLabel[status] }}</span>
    </header>

    <p v-if="coords" class="coords">
      {{ coords.lat.toFixed(5) }}, {{ coords.lng.toFixed(5) }} · ±{{ Math.round(coords.acc) }}m
    </p>

    <div class="actions">
      <button v-if="status !== 'located' && status !== 'locating'" @click="locate">
        {{ status === 'idle' ? 'Locate me' : 'Retry' }}
      </button>
    </div>

    <div class="diag">
      <div v-if="trip">data: {{ trip.diary.length }} diary rows · trail {{ trip.trail.length }} pts</div>
      <div v-else-if="dataError">data error: {{ dataError }}</div>
      <div v-else>data: loading…</div>
      <div>standalone: {{ isStandalone ? 'yes' : 'no' }}</div>
      <div>permission: {{ permState }}</div>
      <div v-if="lastError">err: {{ lastError }}</div>
    </div>
  </main>
</template>

<style scoped>
.planner {
  padding: calc(env(safe-area-inset-top, 0) + 1rem) 1rem 1rem;
  max-width: 40rem;
  margin: 0 auto;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 1.1rem;
}
.status { opacity: 0.6; font-size: 0.8rem; }

.coords {
  margin: 0.5rem 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  opacity: 0.75;
}

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.diag {
  margin-top: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  opacity: 0.6;
  line-height: 1.5;
}

button {
  padding: 0.4rem 0.7rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 0.3rem;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
