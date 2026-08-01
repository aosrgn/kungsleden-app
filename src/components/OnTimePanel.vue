<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryRow } from '../data/trip'
import { planStops, plannedKmAtTime, startOfDay, addDays } from '../plan'

const props = defineProps<{
  diary: DiaryRow[]
  positionKm: number | null
  totalKm: number
  now: Date
  avgKmDay: number
  madeGoodKmh: number
}>()

// Must be in Abisko by ~midday Aug 21 for the KRN→ARN flight (Fri Aug 21 21:05),
// allowing for the Abisko→airport transfer. One deadline drives both buffer and the
// finish flag so they can't disagree.
const DEADLINE = new Date(2026, 7, 21, 12)
// A projected finish on/after Aug 21 is flagged: too tight for the midday-arrival
// transfer even though the flight itself is that evening.
const LATEST_SAFE_FINISH = addDays(startOfDay(DEADLINE), -1)
const DAY_MS = 86400000

const stops = computed(() => planStops(props.diary))
const finished = computed(() => props.positionKm != null && props.positionKm >= props.totalKm)

// Projected Abisko finish from your measured average km/day. Day-granular (assumes a
// full walking day available regardless of the hour it's checked).
const projectedFinish = computed(() => {
  if (props.positionKm == null || props.avgKmDay <= 0) return null
  const remaining = Math.max(0, props.totalKm - props.positionKm)
  const daysLeft = remaining / props.avgKmDay
  return addDays(startOfDay(props.now), Math.max(0, Math.ceil(daysLeft) - 1))
})
const risky = computed(
  () => projectedFinish.value != null && projectedFinish.value.valueOf() > LATEST_SAFE_FINISH.valueOf(),
)

// + = ahead of Plan A: how many km past where the plan expects you right now (which
// ramps only during the day's walking window, so being at camp in the morning reads 0).
const kmDelta = computed(() => {
  if (props.positionKm == null || !stops.value.length) return null
  const planned = plannedKmAtTime(stops.value, props.now)
  return planned == null ? null : props.positionKm - planned
})

// Express the km gap as walking time at your made-good speed — a concrete "you're N
// hours ahead/behind" rather than an abstract ratio.
const scheduleText = computed(() => {
  const km = kmDelta.value
  if (km == null || props.madeGoodKmh <= 0) return null
  const hours = Math.abs(km) / props.madeGoodKmh
  if (hours < 0.5) return 'on schedule'
  const dir = km > 0 ? 'ahead' : 'behind'
  if (hours < 10) return `${hours.toFixed(1)} h ${dir}`
  if (hours < 23.5) return `${Math.round(hours)} h ${dir}`
  return `${(hours / 24).toFixed(1)} days ${dir}`
})
const scheduleDir = computed(() => {
  const km = kmDelta.value
  if (km == null || props.madeGoodKmh <= 0 || Math.abs(km) / props.madeGoodKmh < 0.5) return 'even'
  return km > 0 ? 'ahead' : 'behind'
})

// Spare days between your projected finish and the flight deadline.
const bufferDays = computed(() => {
  const finish = projectedFinish.value
  return finish == null ? null : Math.round(((DEADLINE.valueOf() - finish.valueOf()) / DAY_MS) * 10) / 10
})

const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
</script>

<template>
  <section class="ontime">
    <span class="head">On time</span>

    <template v-if="positionKm == null">
      <p class="line muted">Waiting for position…</p>
    </template>

    <template v-else-if="finished">
      <p class="line">Trek complete. 🎉</p>
    </template>

    <template v-else>
      <div class="stat">
        <span class="label">vs Plan A</span>
        <span class="value" :class="{ ahead: scheduleDir === 'ahead', behind: scheduleDir === 'behind' }">
          {{ scheduleText }}
        </span>
      </div>
      <div v-if="bufferDays != null" class="stat">
        <span class="label">Buffer</span>
        <span class="value" :class="{ behind: bufferDays < 1 }">{{ bufferDays }} days left</span>
      </div>
      <div v-if="projectedFinish" class="stat">
        <span class="label">Finish</span>
        <span class="value" :class="{ behind: risky }">
          {{ dayLabel(projectedFinish) }}<span v-if="risky"> · risks flight</span>
        </span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.ontime {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
.stat {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.label {
  flex: 0 0 4.5rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.value { font-size: 0.9rem; }
.value.ahead { color: #0a7d5a; font-weight: 600; }
.value.behind { color: #c2410c; font-weight: 600; }
.muted { opacity: 0.6; font-size: 0.85rem; }
.line { margin: 0; font-size: 0.9rem; }
</style>
