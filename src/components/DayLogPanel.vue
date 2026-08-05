<script setup lang="ts">
import { computed } from 'vue'
import type { DayMark } from '../composables/useDayLog'

const props = defineProps<{
  marks: DayMark[]
  positionKm: number | null
  trekStart: Date | null
}>()
const emit = defineEmits<{ mark: []; undo: []; setKm: [i: number, km: number]; remove: [i: number] }>()

// Committed on change (not per keystroke) so a half-typed "4" doesn't momentarily move
// the camp to km 4. A blank or unparseable value reverts to what's stored.
function onKm(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const v = parseFloat(el.value.replace(',', '.'))
  if (Number.isFinite(v) && v >= 0) emit('setKm', i, v)
  else el.value = props.marks[i].km.toFixed(1)
}

const DAY_MS = 86400000
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).valueOf()

// Trek day number from the calendar date, NOT the mark's position in the list — a day you
// forgot to mark leaves a gap in the numbering instead of silently renumbering every day
// after it (which is why "today" read D3 on trek day 4).
function trekDay(at: Date): number {
  if (!props.trekStart) return 1
  return Math.max(1, Math.round((midnight(at) - midnight(props.trekStart)) / DAY_MS) + 1)
}

// Each mark starts a day; its distance runs to the next mark, or (for the last,
// in-progress day) to the current position — that last row is the live "km done today".
const days = computed(() =>
  props.marks.map((m, i) => {
    const last = i === props.marks.length - 1
    const endKm = last ? props.positionKm : props.marks[i + 1].km
    const at = new Date(m.at)
    return {
      key: m.at,
      i,
      n: trekDay(at),
      at,
      campKm: m.km,
      km: endKm == null ? null : Math.max(0, endKm - m.km),
      inProgress: last,
    }
  }),
)
const total = computed(() =>
  days.value.reduce((s, d) => s + (d.km ?? 0), 0),
)

const dayLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })
</script>

<template>
  <section class="daylog">
    <div class="top">
      <span class="head">Day log</span>
      <div class="actions">
        <button class="mark" :disabled="positionKm == null" @click="emit('mark')">Mark camp</button>
        <button v-if="marks.length" class="undo" @click="emit('undo')">undo</button>
      </div>
    </div>

    <ol v-if="days.length" class="days">
      <li v-for="d in days" :key="d.key">
        <span class="d">D{{ d.n }}</span>
        <span class="date">{{ dayLabel(d.at) }}</span>
        <label class="camp">
          <span class="at">camp</span>
          <input
            :value="d.campKm.toFixed(1)"
            type="number"
            step="0.1"
            min="0"
            inputmode="decimal"
            @change="onKm(d.i, $event)"
          />
        </label>
        <span class="km">
          <template v-if="d.km == null">—</template>
          <template v-else>{{ d.km.toFixed(1) }} km<span v-if="d.inProgress" class="sofar"> so far</span></template>
        </span>
        <button class="del" title="remove this camp" @click="emit('remove', d.i)">×</button>
      </li>
      <li v-if="days.length > 1" class="total">
        <span class="d"></span><span class="date">total</span><span class="camp"></span>
        <span class="km">{{ total.toFixed(1) }} km</span><span class="del"></span>
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
.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
.mark:disabled {
  opacity: 0.4;
  cursor: default;
}
.undo {
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
}
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
.days .d {
  font-weight: 650;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.days .date { opacity: 0.6; font-size: 0.78rem; }
.days .km { font-variant-numeric: tabular-nums; text-align: right; }
.sofar { opacity: 0.55; }
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
