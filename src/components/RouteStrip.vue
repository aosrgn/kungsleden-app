<script setup lang="ts">
import { computed, nextTick, watch, useTemplateRef } from 'vue'
import type { DiaryRow } from '../data/trip'
import { planStops, poiArrival, realisedStops, type PoiArrival, type CampMark } from '../plan'

const props = defineProps<{
  rows: DiaryRow[]
  camps?: { km: number; day: number; label: string }[]
  positionKm?: number | null
  now?: Date | null
  speedKmh?: number | null
  totalKm?: number | null
  startHour?: number | null
  endHour?: number | null
  marks?: CampMark[]
}>()

// Clock-time ETA is only meaningful for nodes reachable within a long day's walk;
// beyond that a bare "HH:MM" would span days and mislead, so it's omitted.
const ETA_MAX_HOURS = 14

// A camp you actually slept at, rendered on the line as a pseudo-row so the km/passed/
// here-marker machinery treats it like any other node.
const CAMP_TYPE = 'camp-mark'

// Each day's crossing times run from the REAL camp that started it, where one is logged.
const stops = computed(() => realisedStops(planStops(props.rows), props.marks ?? []))

const campRows = computed<DiaryRow[]>(() =>
  (props.camps ?? []).map((c) => ({
    icon: '⛺',
    name: c.label,
    type: CAMP_TYPE,
    date: '',
    overnight: false,
    fromStart: c.km,
    lat: null,
    lon: null,
    toNextHut: null,
    crossedKm: null,
    hiked: null,
    notHiked: null,
    total: null,
    notes: '',
  })),
)

// Every located diary feature plus your own camps, ordered along the route.
const nodes = computed(() =>
  [...props.rows.filter((r) => r.fromStart != null), ...campRows.value].sort(
    (a, b) => (a.fromStart as number) - (b.fromStart as number),
  ),
)

// Planned per-day crossing clock-time (from the day's camp + start hour + made-good
// speed). Your own camps are history, not a schedule — they get no planned time.
function plannedFor(node: DiaryRow) {
  if (node.type === CAMP_TYPE) return null
  if (props.startHour == null || !props.speedKmh) return null
  if (props.totalKm != null && (node.fromStart as number) > props.totalKm) return null
  return poiArrival(stops.value, node.fromStart as number, props.startHour, props.speedKmh)
}
function hhmm(clockHours: number): string {
  const total = Math.round(clockHours * 60)
  if (total >= 24 * 60) return 'past 24:00'
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
// A camp whose planned arrival falls after the day's end hour is a long day.
function longDay(node: DiaryRow, planned: PoiArrival | null): boolean {
  return node.overnight && planned != null && props.endHour != null && planned.clockHours > props.endHour
}

// Index where the "you are here" marker sits: before the first node not yet
// reached. nodes.length means every node is behind you. null = no fix yet.
const hereIndex = computed(() => {
  const km = props.positionKm
  if (km == null) return null
  const i = nodes.value.findIndex((n) => (n.fromStart as number) >= km)
  return i === -1 ? nodes.value.length : i
})

// One render list with the here-marker spliced in at hereIndex, so the marker
// template lives in a single place. Planned crossing time is resolved once per node here.
type Item = { here: true } | { here: false; node: DiaryRow; planned: PoiArrival | null }
const items = computed<Item[]>(() => {
  const list: Item[] = nodes.value.map((node) => ({ here: false, node, planned: plannedFor(node) }))
  if (hereIndex.value != null) list.splice(hereIndex.value, 0, { here: true })
  return list
})

function delta(node: DiaryRow): number {
  return (node.fromStart as number) - (props.positionKm as number)
}
// Signed km-ahead label; collapses tiny magnitudes to avoid a "-0.0" readout.
function deltaLabel(node: DiaryRow): string {
  const d = delta(node)
  if (Math.abs(d) < 0.05) return '0.0'
  return d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)
}
function isPassed(node: DiaryRow): boolean {
  return props.positionKm != null && (node.fromStart as number) < props.positionKm
}
// Clock-time you'd reach a node ahead, at the current pace; null if not computable
// or too far ahead to render as a same-ish-day time.
function etaLabel(node: DiaryRow): string | null {
  if (node.type === CAMP_TYPE) return null
  if (props.positionKm == null || props.now == null || !props.speedKmh) return null
  // Post-hike transport rows sit beyond the trail end — you don't walk to them.
  if (props.totalKm != null && (node.fromStart as number) > props.totalKm) return null
  const kmAhead = delta(node)
  if (kmAhead <= 0) return null
  const hours = kmAhead / props.speedKmh
  if (hours > ETA_MAX_HOURS) return null
  const at = new Date(props.now.valueOf() + hours * 3600000)
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// On the first fix, bring the here-marker into view; later fixes just shift the
// marker between nodes as you walk, without yanking the scroll position.
const stripEl = useTemplateRef<HTMLElement>('stripEl')
watch(
  () => props.positionKm,
  (now, prev) => {
    if (now != null && prev == null) {
      nextTick(() => stripEl.value?.querySelector('.here')?.scrollIntoView({ block: 'center' }))
    }
  },
)
</script>

<template>
  <ol ref="stripEl" class="strip">
    <template v-for="(item, i) in items" :key="i">
      <li v-if="item.here" class="here">
        <span class="km">{{ (positionKm as number).toFixed(1) }}</span>
        <span class="rail"><span class="here-dot" /></span>
        <span class="here-label">You are here</span>
      </li>
      <li
        v-else
        class="node"
        :class="{
          overnight: item.node.overnight,
          camp: item.node.type === 'camp-mark',
          passed: isPassed(item.node),
        }"
      >
        <span class="km">
          <template v-if="positionKm == null">{{ (item.node.fromStart as number).toFixed(1) }}</template>
          <template v-else>{{ deltaLabel(item.node) }}</template>
        </span>
        <span class="rail"><span class="dot" /></span>
        <span class="label">
          <span class="name">{{ item.node.icon }} {{ item.node.name }}</span>
          <span class="times">
            <span v-if="item.planned" class="planned">
              D{{ item.planned.day }} {{ hhmm(item.planned.clockHours) }}
              <span v-if="longDay(item.node, item.planned)" class="late">· long day</span>
            </span>
            <span v-if="etaLabel(item.node)" class="eta">eta {{ etaLabel(item.node) }}</span>
          </span>
          <span v-if="item.node.notes" class="note">{{ item.node.notes }}</span>
        </span>
      </li>
    </template>
  </ol>
</template>

<style scoped>
.strip {
  list-style: none;
  margin: 0;
  padding: 0;
  /* position accent — darker on light bg / lighter on dark bg, so it stays legible */
  --here: #0a5fd0;
}
@media (prefers-color-scheme: dark) {
  .strip { --here: #4d9fff; }
}

.node,
.here {
  display: grid;
  grid-template-columns: 3.25rem 1.25rem 1fr;
  align-items: start;
  column-gap: 0.5rem;
  min-height: 2.4rem;
}

.km {
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  opacity: 0.6;
  padding-top: 0.1rem;
}

/* the continuous vertical line, with the node's dot centered on it */
.rail {
  position: relative;
  align-self: stretch;
  justify-self: center;
  width: 1.25rem;
}
.rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: color-mix(in srgb, currentColor 22%, transparent);
}
.dot {
  position: absolute;
  top: 0.35rem;
  left: 50%;
  width: 0.6rem;
  height: 0.6rem;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 45%, transparent);
}

.label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-bottom: 0.6rem;
}
.name { font-size: 0.9rem; }
.times {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem 0.6rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
}
.planned { opacity: 0.8; white-space: nowrap; }
.late { color: #c2410c; }
.eta {
  opacity: 0.55;
  white-space: nowrap;
}
.passed .times { opacity: 1; }
.note {
  font-size: 0.72rem;
  opacity: 0.6;
  line-height: 1.35;
}

/* camps you actually slept at — squared off, so they read as fact next to the round
   planned nodes, and stay legible after .passed dims them */
.camp .dot {
  top: 0.4rem;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 0.15rem;
  background: #b45309;
}
.camp .name { font-weight: 650; color: #b45309; }
.camp.passed { opacity: 0.72; }

/* overnight stops stand out along the line */
.overnight .dot {
  top: 0.4rem;
  width: 0.85rem;
  height: 0.85rem;
  background: #0a7d5a;
}
.overnight .name { font-weight: 650; }

/* passed features recede — dim the whole node uniformly (reset the children's own
   opacity so it doesn't compound into near-invisible km/note text) */
.passed { opacity: 0.42; }
.passed .km,
.passed .note { opacity: 1; }

/* the live position marker */
.here .km {
  opacity: 1;
  font-weight: 700;
  color: var(--here);
}
.here-dot {
  position: absolute;
  top: 0.35rem;
  left: 50%;
  width: 0.9rem;
  height: 0.9rem;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--here);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--here) 30%, transparent);
}
.here-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--here);
  padding-bottom: 0.6rem;
}
</style>
