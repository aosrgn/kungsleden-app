<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGeolocation } from '../composables/useGeolocation'
import { loadTrip, type Trip } from '../data/trip'
import { createTrailIndex } from '../trail'
import NowPanel from './NowPanel.vue'
import RouteStrip from './RouteStrip.vue'

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

const trailIndex = computed(() => (trip.value ? createTrailIndex(trip.value.trail) : null))
const position = computed(() =>
  trailIndex.value && coords.value
    ? trailIndex.value.project(coords.value.lat, coords.value.lng)
    : null,
)

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
      <template v-if="position"> · {{ Math.round(position.offsetKm * 1000) }}m off-trail</template>
    </p>

    <div class="actions">
      <button v-if="status !== 'located' && status !== 'locating'" @click="locate">
        {{ status === 'idle' ? 'Locate me' : 'Retry' }}
      </button>
    </div>

    <NowPanel
      v-if="trip"
      :position-km="position?.km ?? null"
      :total-km="trailIndex?.totalKm ?? 0"
      :lat="coords?.lat ?? null"
      :lng="coords?.lng ?? null"
      class="now-panel"
    />
    <RouteStrip v-if="trip" :rows="trip.diary" :position-km="position?.km ?? null" class="route" />
    <p v-else-if="dataError" class="data-msg">data error: {{ dataError }}</p>
    <p v-else class="data-msg">loading route…</p>

    <div class="diag">
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

.now-panel { margin-top: 1rem; }
.route { margin-top: 1rem; }

.data-msg {
  margin-top: 1rem;
  font-size: 0.85rem;
  opacity: 0.7;
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
