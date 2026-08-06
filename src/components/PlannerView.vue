<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGeolocation } from '../composables/useGeolocation'
import { useNow } from '../composables/useNow'
import { useSpeed } from '../composables/useSpeed'
import { useDayLog } from '../composables/useDayLog'
import { loadTrip, type Trip } from '../data/trip'
import { planStops, campsByNight, addDays } from '../plan'
import { createTrailIndex } from '../trail'
import NowPanel from './NowPanel.vue'
import TodayPanel from './TodayPanel.vue'
import OnTimePanel from './OnTimePanel.vue'
import SpeedControl from './SpeedControl.vue'
import RouteStrip from './RouteStrip.vue'
import DayLogPanel from './DayLogPanel.vue'
import GpxExport from './GpxExport.vue'

const { status, coords, lastError, permState, isStandalone, locate } = useGeolocation()
const now = useNow()
const { startHour, endHour, kmDay } = useSpeed()
const { marks, mark, setKm, remove } = useDayLog()

function markCamp() {
  // Marks from the REAL on-trail position only — never the simulated km (§ below).
  if (realPositionKm.value != null) mark(realPositionKm.value, now.value.valueOf())
}

// Made-good speed (breaks included) = the day's distance spread over the walking window.
// Drives ETAs and the POI crossing times only — the finish projection is plan-relative
// (see OnTimePanel) and needs no pace input at all.
const madeGoodKmh = computed(() => kmDay.value / Math.max(1, endHour.value - startHour.value))

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
// Day 1 of the trek, from the diary — the day log and the strip's camp pins number
// their rows against it, so a day you forgot to mark leaves a gap instead of a reshuffle.
const trekStart = computed(() => (trip.value ? (planStops(trip.value.diary)[0]?.date ?? null) : null))

const monthDay = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })

// One camp per night, resolved from the marks. campsByNight decides which night a mark
// records from the HOUR it was tapped, so marking on arrival in the evening and marking
// over breakfast next morning both land on the same night instead of a night apart.
const nightCamps = computed(() => campsByNight(marks.value, trekStart.value))

// Strip pins, named for the night they closed so each lands beside the diary's planned
// camp for that same night. Each carries the distance walked to reach it: the gap back to
// the previous camp, or the km-0 trailhead for the first.
const campPins = computed(() =>
  nightCamps.value.map((c, i) => {
    const eve = addDays(trekStart.value as Date, c.night - 1)
    const morn = addDays(eve, 1)
    const span =
      eve.getMonth() === morn.getMonth()
        ? `${monthDay(eve)}→${morn.getDate()}`
        : `${monthDay(eve)}→${monthDay(morn)}`
    const walked = Math.max(0, c.km - (i > 0 ? nightCamps.value[i - 1].km : 0))
    return { km: c.km, label: `Camp D${c.night} · ${span}`, note: `${walked.toFixed(1)} km walked` }
  }),
)
const position = computed(() =>
  trailIndex.value && coords.value
    ? trailIndex.value.project(coords.value.lat, coords.value.lng)
    : null,
)
// A fix far from the trail line (e.g. testing at home) shouldn't drive the planner —
// only treat the position as on-route within this offset.
const OFF_TRAIL_KM = 2
const onTrail = computed(() => position.value != null && position.value.offsetKm <= OFF_TRAIL_KM)
const realPositionKm = computed(() => (onTrail.value ? position.value!.km : null))

// Test/preview override: type a km to exercise the planner off-trail (before the trek).
// null = off (use the real GPS-derived km). Every panel + the strip reads this.
// The input binds to its OWN string ref (v-model) so frequent re-renders (GPS/clock)
// don't wipe what's being typed; it's committed to simKm on change.
const simKm = ref<number | null>(null)
const simKmInput = ref<string>('')
const positionKm = computed(() => (simKm.value != null ? simKm.value : realPositionKm.value))
function commitSim() {
  const v = parseFloat(simKmInput.value)
  const total = trailIndex.value?.totalKm ?? 460
  simKm.value = Number.isFinite(v) ? Math.min(total, Math.max(0, v)) : null
  simKmInput.value = simKm.value == null ? '' : String(simKm.value)
}
function clearSim() {
  simKm.value = null
  simKmInput.value = ''
}

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

    <p v-if="simKm != null" class="coords sim">⚠ simulating km {{ simKm.toFixed(1) }} — not real GPS</p>
    <p v-else-if="coords" class="coords">
      {{ coords.lat.toFixed(5) }}, {{ coords.lng.toFixed(5) }} · ±{{ Math.round(coords.acc) }}m
      <template v-if="position && onTrail"> · {{ Math.round(position.offsetKm * 1000) }}m off-trail</template>
      <template v-else-if="position"> · off route ({{ position.offsetKm.toFixed(0) }} km) — planner paused</template>
    </p>

    <div class="actions">
      <button v-if="status !== 'located' && status !== 'locating'" @click="locate">
        {{ status === 'idle' ? 'Locate me' : 'Retry' }}
      </button>
    </div>

    <NowPanel
      v-if="trip"
      :position-km="positionKm"
      :total-km="trailIndex?.totalKm ?? 0"
      :lat="coords?.lat ?? null"
      :lng="coords?.lng ?? null"
      :now="now"
      class="now-panel"
    />
    <TodayPanel
      v-if="trip"
      :diary="trip.diary"
      :position-km="positionKm"
      :now="now"
      :speed-kmh="madeGoodKmh"
      class="today-panel"
    />
    <OnTimePanel
      v-if="trip"
      :diary="trip.diary"
      :position-km="positionKm"
      :total-km="trailIndex?.totalKm ?? 0"
      :now="now"
      :start-hour="startHour"
      :end-hour="endHour"
      :made-good-kmh="madeGoodKmh"
      class="ontime-panel"
    />
    <DayLogPanel
      v-if="trip"
      :camps="nightCamps"
      :position-km="realPositionKm"
      :trek-start="trekStart"
      :now="now"
      class="daylog-panel"
      @mark="markCamp"
      @set-km="setKm"
      @remove="remove"
    />
    <SpeedControl
      v-if="trip"
      v-model:start-hour="startHour"
      v-model:end-hour="endHour"
      v-model:km-day="kmDay"
      :made-good-kmh="madeGoodKmh"
      class="speed-control"
    />
    <GpxExport class="gpx-export" />
    <RouteStrip
      v-if="trip"
      :rows="trip.diary"
      :pins="campPins"
      :night-camps="nightCamps"
      :position-km="positionKm"
      :now="now"
      :speed-kmh="madeGoodKmh"
      :total-km="trailIndex?.totalKm ?? null"
      :start-hour="startHour"
      :end-hour="endHour"
      class="route"
    />
    <p v-else-if="dataError" class="data-msg">data error: {{ dataError }}</p>
    <p v-else class="data-msg">loading route…</p>

    <div class="diag">
      <div class="sim-row">
        <label>simulate km:
          <input v-model="simKmInput" type="number" step="1" min="0" placeholder="off" @change="commitSim" />
        </label>
        <button v-if="simKm != null" @click="clearSim">clear</button>
      </div>
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
.today-panel { margin-top: 0.6rem; }
.ontime-panel { margin-top: 0.6rem; }
.daylog-panel { margin-top: 0.6rem; }
.speed-control { margin-top: 0.6rem; }
.gpx-export { margin-top: 0.6rem; }
.route { margin-top: 1rem; }

.data-msg {
  margin-top: 1rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

.coords.sim { color: #c2410c; opacity: 1; }

.diag {
  margin-top: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  opacity: 0.6;
  line-height: 1.5;
}
.sim-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
}
.sim-row input {
  width: 4rem;
  padding: 0.15rem 0.3rem;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  border-radius: 0.3rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.sim-row button {
  padding: 0.1rem 0.4rem;
  font-size: 0.7rem;
  border-radius: 0.3rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  cursor: pointer;
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
