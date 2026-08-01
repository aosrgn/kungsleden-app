<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryRow } from '../data/trip'
import { planStops, plannedArrivalAtKm, startOfDay, addDays } from '../plan'

const props = defineProps<{
  diary: DiaryRow[]
  positionKm: number | null
  totalKm: number
  now: Date
  paceKmh: number
  hoursPerDay: number
}>()

// Must be in Abisko by ~midday Aug 21 for the KRN→ARN flight (Fri Aug 21 21:05),
// allowing for the Abisko→airport transfer. One deadline drives both buffer and the
// per-pace flag so they can't disagree.
const DEADLINE = new Date(2026, 7, 21, 12)
// Day-granular projected finishes on/after Aug 21 are flagged: too tight for the
// midday-arrival transfer even though the flight itself is that evening.
const LATEST_SAFE_FINISH = addDays(startOfDay(DEADLINE), -1)
const DAY_MS = 86400000
const PACE_PRESETS = [3.0, 3.5, 4.0]

const stops = computed(() => planStops(props.diary))
// Plan A's finish reached at km-total, anchored the same way (18:00) as deltaMs, so
// buffer and schedule delta share one reference frame.
const plannedFinish = computed(() => (stops.value.length ? plannedArrivalAtKm(stops.value, props.totalKm) : null))
const finished = computed(() => props.positionKm != null && props.positionKm >= props.totalKm)

// + = ahead of Plan A (you reached this km before the plan expects you), − = behind.
const deltaMs = computed(() => {
  if (props.positionKm == null || !stops.value.length) return null
  const planned = plannedArrivalAtKm(stops.value, props.positionKm)
  return planned ? planned.valueOf() - props.now.valueOf() : null
})

const scheduleText = computed(() => {
  const ms = deltaMs.value
  if (ms == null) return null
  const hours = Math.abs(ms) / 3600000
  if (hours < 2) return 'on schedule'
  const dir = ms > 0 ? 'ahead' : 'behind'
  if (hours < 23.5) return `${Math.round(hours)} h ${dir}`
  return `${(hours / 24).toFixed(1)} days ${dir}`
})
const scheduleDir = computed(() => {
  const ms = deltaMs.value
  if (ms == null || Math.abs(ms) < 2 * 3600000) return 'even'
  return ms > 0 ? 'ahead' : 'behind'
})

// Spare days before the flight deadline, shifted by your ±schedule. Same anchor as
// deltaMs (plannedFinish is 18:00-anchored), so it's internally consistent.
const bufferDays = computed(() => {
  if (deltaMs.value == null || !plannedFinish.value) return null
  const base = (DEADLINE.valueOf() - plannedFinish.value.valueOf()) / DAY_MS
  return Math.round((base + deltaMs.value / DAY_MS) * 10) / 10
})

// Projected Abisko finish date for each pace, at the chosen hours/day. Position-only
// (assumes a full walking day ahead regardless of the hour it's checked).
const finishRows = computed(() => {
  if (props.positionKm == null) return []
  const remaining = Math.max(0, props.totalKm - props.positionKm)
  const paces = [...new Set([...PACE_PRESETS, Math.round(props.paceKmh * 10) / 10])].sort((a, b) => a - b)
  return paces.map((pace) => {
    const kmPerDay = pace * props.hoursPerDay
    const daysLeft = remaining / kmPerDay
    const date = addDays(startOfDay(props.now), Math.max(0, Math.ceil(daysLeft) - 1))
    return {
      pace,
      isCurrent: pace === Math.round(props.paceKmh * 10) / 10,
      date,
      risky: date.valueOf() > LATEST_SAFE_FINISH.valueOf(),
    }
  })
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

      <div class="finish">
        <span class="label">Finish</span>
        <ul class="paces">
          <li v-for="r in finishRows" :key="r.pace" :class="{ current: r.isCurrent, risky: r.risky }">
            <span class="pace">{{ r.pace.toFixed(1) }} km/h<span v-if="r.isCurrent"> ·you</span></span>
            <span class="date">{{ dayLabel(r.date) }}<span v-if="r.risky"> · risks flight</span></span>
          </li>
        </ul>
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

.finish {
  display: flex;
  gap: 0.6rem;
}
.paces {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
}
.paces li {
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
}
.paces .pace { opacity: 0.7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.paces li.current { font-weight: 650; }
.paces li.current .pace { opacity: 1; }
.paces li.risky .date { color: #c2410c; }
</style>
