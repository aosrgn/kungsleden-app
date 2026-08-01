<script setup lang="ts">
import { computed } from 'vue'
import type { DayMark } from '../composables/useDayLog'

const props = defineProps<{
  marks: DayMark[]
  positionKm: number | null
}>()
const emit = defineEmits<{ mark: []; undo: [] }>()

// Each mark starts a day; its distance runs to the next mark, or (for the last,
// in-progress day) to the current position.
const days = computed(() =>
  props.marks.map((m, i) => {
    const last = i === props.marks.length - 1
    const endKm = last ? props.positionKm : props.marks[i + 1].km
    return {
      n: i + 1,
      at: new Date(m.at),
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
        <button class="mark" :disabled="positionKm == null" @click="emit('mark')">Mark day start</button>
        <button v-if="marks.length" class="undo" @click="emit('undo')">undo</button>
      </div>
    </div>

    <ol v-if="days.length" class="days">
      <li v-for="d in days" :key="d.n">
        <span class="d">D{{ d.n }}</span>
        <span class="date">{{ dayLabel(d.at) }}</span>
        <span class="km">
          <template v-if="d.km == null">—</template>
          <template v-else>{{ d.km.toFixed(1) }} km<span v-if="d.inProgress" class="sofar"> so far</span></template>
        </span>
      </li>
      <li v-if="days.length > 1" class="total">
        <span class="d"></span><span class="date">total</span><span class="km">{{ total.toFixed(1) }} km</span>
      </li>
    </ol>
    <p v-else class="empty">Tap “Mark day start” each morning to log daily distances.</p>
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
  grid-template-columns: 2.2rem 1fr auto;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
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
