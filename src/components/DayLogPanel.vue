<script setup lang="ts">
import { computed } from 'vue'
import type { NightCamp } from '../plan'
import { addDays, startOfDay } from '../plan'

const props = defineProps<{
  camps: NightCamp[]
  positionKm: number | null
  trekStart: Date | null
  now: Date
}>()
const emit = defineEmits<{
  mark: []
  setKm: [i: number, km: number]
  remove: [i: number]
}>()

// Night n ended trek day n, so its row is dated day n and carries that day's distance:
// this camp's km minus the previous one's (the trailhead, km 0, for the first).
const days = computed(() => {
  const rows = props.camps.map((c, i) => ({
    key: `n${c.night}`,
    markIndex: c.markIndex,
    n: c.night,
    at: props.trekStart ? addDays(props.trekStart, c.night - 1) : new Date(c.at),
    campKm: c.km,
    km: Math.max(0, c.km - (i > 0 ? props.camps[i - 1].km : 0)),
    inProgress: false,
  }))

  // The open day runs from the last camp to where you are. Suppressed until that day has
  // actually begun, so an evening mark doesn't immediately sprout a 0.0 km row for tomorrow.
  const last = props.camps[props.camps.length - 1]
  if (last && props.trekStart && props.positionKm != null) {
    const at = addDays(props.trekStart, last.night)
    if (startOfDay(at).valueOf() <= startOfDay(props.now).valueOf()) {
      rows.push({
        key: 'open',
        markIndex: -1,
        n: last.night + 1,
        at,
        campKm: last.km,
        km: Math.max(0, props.positionKm - last.km),
        inProgress: true,
      })
    }
  }
  return rows
})

const total = computed(() => days.value.reduce((s, d) => s + d.km, 0))

// Committed on change (not per keystroke) so a half-typed "4" doesn't momentarily move
// the camp to km 4. A blank or unparseable value reverts to what's stored.
function onKm(markIndex: number, current: number, e: Event) {
  const el = e.target as HTMLInputElement
  const v = parseFloat(el.value.replace(',', '.'))
  if (Number.isFinite(v) && v >= 0) emit('setKm', markIndex, v)
  else el.value = current.toFixed(1)
}

const dayLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })
</script>

<template>
  <section class="daylog">
    <div class="top">
      <span class="head">Day log</span>
      <button class="mark" :disabled="positionKm == null" @click="emit('mark')">Mark camp</button>
    </div>

    <ol v-if="days.length" class="days">
      <li v-for="d in days" :key="d.key">
        <span class="d">D{{ d.n }}</span>
        <span class="date">{{ dayLabel(d.at) }}</span>
        <label v-if="!d.inProgress" class="camp">
          <span class="at">camp</span>
          <input
            :value="d.campKm.toFixed(1)"
            type="number"
            step="0.1"
            min="0"
            inputmode="decimal"
            @change="onKm(d.markIndex, d.campKm, $event)"
          />
        </label>
        <span v-else class="camp" />
        <span class="km">
          {{ d.km.toFixed(1) }} km<span v-if="d.inProgress" class="sofar"> so far</span>
        </span>
        <button v-if="!d.inProgress" class="del" title="remove this camp" @click="emit('remove', d.markIndex)">
          ×
        </button>
        <span v-else class="del" />
      </li>
      <li v-if="days.length > 1" class="total">
        <span class="d" /><span class="date">total</span><span class="camp" />
        <span class="km">{{ total.toFixed(1) }} km</span><span class="del" />
      </li>
    </ol>
    <p v-else class="empty">Tap “Mark camp” at each overnight stop to log daily distances.</p>
  </section>
</template>

<style scoped>
.daylog {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}
.head {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.mark {
  padding: 0.3rem 0.7rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 1rem;
  font-size: 0.78rem;
  cursor: pointer;
}
.mark:disabled { opacity: 0.4; cursor: default; }
.days {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.days li {
  display: grid;
  grid-template-columns: 2.2rem auto 1fr auto 1rem;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
}
.days .d {
  font-weight: 650;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.days .date { opacity: 0.6; font-size: 0.78rem; }
.days .km { font-variant-numeric: tabular-nums; text-align: right; }
.sofar { opacity: 0.55; }
.camp {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  opacity: 0.75;
}
.camp .at { opacity: 0.6; }
.camp input {
  width: 3.4rem;
  padding: 0.1rem 0.25rem;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  border-radius: 0.3rem;
  background: transparent;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  text-align: right;
}
.del {
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.35;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}
.total {
  margin-top: 0.15rem;
  padding-top: 0.2rem;
  border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  opacity: 0.8;
}
.empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.6;
}
</style>
