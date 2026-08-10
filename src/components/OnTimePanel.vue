<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryRow } from '../data/trip'
import { planStops, plannedKmAtTime, planSpan } from '../plan'

const props = defineProps<{
  diary: DiaryRow[]
  positionKm: number | null
  totalKm: number
  now: Date
  startHour: number
  endHour: number
  madeGoodKmh: number
}>()

// Must be in Abisko by ~midday Aug 21 for the KRN→ARN flight (Fri Aug 21 21:05),
// allowing for the Abisko→airport transfer. One deadline drives both buffer and the
// finish flag so they can't disagree.
const DEADLINE = new Date(2026, 7, 21, 12)
const DAY_MS = 86400000

const stops = computed(() => planStops(props.diary))
const finished = computed(() => props.positionKm != null && props.positionKm >= props.totalKm)

const plannedNow = computed(() =>
  props.positionKm == null || !stops.value.length
    ? null
    : plannedKmAtTime(stops.value, props.now, props.startHour, props.endHour),
)

// How your progress compares to Plan A's, as a plain ratio of distance covered. Because
// both sides span the same days, the plan's deliberate ease-in (7 km on day 1, 18 on
// day 2) cancels out — projecting a measured km/day instead read those short days as
// "slow" and swore you'd miss the flight while you were in fact ahead.
// Clamped: a few km either way on day 1 would otherwise imply an absurd trip-wide rate.
const RATIO_RANGE = { min: 0.4, max: 2.5 }
const ratio = computed(() => {
  const planned = plannedNow.value
  if (planned == null || props.positionKm == null) return null
  if (planned <= 1) return 1 // pre-trek / first km — nothing meaningful to compare yet
  return Math.min(RATIO_RANGE.max, Math.max(RATIO_RANGE.min, props.positionKm / planned))
})

// Projected Abisko finish, as plain distance ÷ rate: you have `yourKmLeft` to walk, and
// you cover ground at the plan's remaining rate scaled by your ratio.
//
// It must be measured from NOW, never from "the time the plan had you at your km" — that
// earlier moment is usually on a previous day, so the span back to the finish re-counts a
// night you have already slept. That charged ~15 h of phantom lateness every morning:
// parked at the planned camp, exactly on plan, the finish drifted from Aug 19 18:00 to
// Aug 20 09:00 across a single night without moving.
const projectedFinish = computed(() => {
  const r = ratio.value
  const span = stops.value.length ? planSpan(stops.value, props.startHour, props.endHour) : null
  if (r == null || span == null || props.positionKm == null || plannedNow.value == null) return null

  const yourKmLeft = Math.max(0, props.totalKm - props.positionKm)
  const planKmLeft = props.totalKm - plannedNow.value
  const planMsLeft = span.end.valueOf() - props.now.valueOf()

  // Inside the plan's own window: borrow its remaining rate, which keeps the day-by-day
  // shape (the long middle days cost more than the ease-in ones).
  if (planKmLeft > 0.5 && planMsLeft > 0) {
    return new Date(props.now.valueOf() + (planMsLeft * (yourKmLeft / planKmLeft)) / r)
  }
  // Past the plan's last day, or the plan is already at Abisko: no remaining schedule to
  // borrow, so fall back to its overall average rate, still scaled by your ratio.
  const planDays = (span.end.valueOf() - span.start.valueOf()) / DAY_MS
  const kmPerDay = (props.totalKm / Math.max(1, planDays)) * r
  return new Date(props.now.valueOf() + (yourKmLeft / kmPerDay) * DAY_MS)
})

// + = ahead of Plan A: how many km past where the plan expects you right now (which
// ramps only during the day's walking window, so being at camp in the morning reads 0).
const kmDelta = computed(() =>
  plannedNow.value == null || props.positionKm == null ? null : props.positionKm - plannedNow.value,
)

// The gap both ways: the raw km (what you have to make up) and what that costs in walking
// time at your made-good speed — concrete, rather than an abstract ratio.
const scheduleText = computed(() => {
  const km = kmDelta.value
  if (km == null || props.madeGoodKmh <= 0) return null
  const hours = Math.abs(km) / props.madeGoodKmh
  if (hours < 0.5) return 'on schedule'
  const dir = km > 0 ? 'ahead' : 'behind'
  const dist = `${Math.abs(km).toFixed(1)} km`
  const time =
    hours < 10 ? `${hours.toFixed(1)} h` : hours < 23.5 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1)} days`
  return `${dist} · ${time} ${dir}`
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
// Flagged off the same number the buffer shows, so the two can never disagree.
const risky = computed(() => bufferDays.value != null && bufferDays.value < 0.5)

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
