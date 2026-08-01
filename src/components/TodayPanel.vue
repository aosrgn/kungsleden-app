<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryRow } from '../data/trip'
import { planStops, huts, stopForDay, trekPhase } from '../plan'

const props = defineProps<{
  diary: DiaryRow[]
  positionKm: number | null
  now: Date
  speedKmh: number
}>()

const PUSH_WINDOW_MS = 2 * 3600 * 1000 // how far past the planned stop a next hut may be

const stops = computed(() => planStops(props.diary))
const allHuts = computed(() => huts(props.diary))
const phase = computed(() => trekPhase(stops.value, props.now))
const today = computed(() => stopForDay(stops.value, props.now))

function etaAt(km: number): Date | null {
  if (props.positionKm == null || km <= props.positionKm) return null
  const hours = (km - props.positionKm) / props.speedKmh
  return new Date(props.now.valueOf() + hours * 3600000)
}

const atOrPastStop = computed(
  () => today.value != null && props.positionKm != null && props.positionKm >= today.value.km,
)
const stopEta = computed(() => (today.value ? etaAt(today.value.km) : null))

// Huts between here and tonight's planned stop.
const passing = computed(() => {
  const t = today.value
  if (!t || props.positionKm == null) return []
  return allHuts.value.filter((h) => h.km > props.positionKm! && h.km < t.km)
})

// The first hut beyond the stop, shown only if reachable within the push window.
const push = computed(() => {
  const t = today.value
  const se = stopEta.value
  if (!t || !se) return null
  const next = allHuts.value.find((h) => h.km > t.km)
  if (!next) return null
  const ne = etaAt(next.km)
  return ne && ne.valueOf() <= se.valueOf() + PUSH_WINDOW_MS ? { hut: next, eta: ne } : null
})

const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
const kmAhead = (km: number) => (props.positionKm == null ? null : Math.round(km - props.positionKm))
const firstStop = computed(() => stops.value[0] ?? null)
const dayLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })
</script>

<template>
  <section class="today">
    <span class="head">Today</span>

    <template v-if="phase === 'pre' && firstStop">
      <p class="line">Trek starts {{ dayLabel(firstStop.date) }} — first stop {{ firstStop.name }} (km {{ firstStop.km }}).</p>
    </template>

    <template v-else-if="phase === 'post'">
      <p class="line">Trek complete. 🎉</p>
    </template>

    <template v-else-if="today">
      <p class="line stop">
        <span class="name">🌙 {{ today.name }} · km {{ today.km }}</span>
        <span v-if="atOrPastStop" class="tag">reached</span>
        <span v-else-if="stopEta" class="tag">ETA ~{{ hhmm(stopEta) }} · +{{ kmAhead(today.km) }} km</span>
        <span v-else class="tag muted">waiting for position…</span>
      </p>

      <p v-if="passing.length" class="line sub">
        Passing:
        <span v-for="h in passing" :key="h.km" class="hut">{{ h.icon }} {{ h.name }} (~{{ hhmm(etaAt(h.km)!) }})</span>
      </p>

      <p v-if="push" class="line sub push">
        Could push on: {{ push.hut.icon }} {{ push.hut.name }} · km {{ push.hut.km }} · ~{{ hhmm(push.eta) }}
      </p>
    </template>

    <template v-else>
      <p class="line muted">No plan stop for today.</p>
    </template>
  </section>
</template>

<style scoped>
.today {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.head {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.line {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}
.stop {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.stop .name { font-weight: 650; }
.tag {
  font-size: 0.8rem;
  opacity: 0.85;
}
.sub {
  font-size: 0.8rem;
  opacity: 0.75;
}
.hut { margin-right: 0.6rem; white-space: nowrap; }
.push { opacity: 0.85; }
.muted { opacity: 0.6; }
</style>
