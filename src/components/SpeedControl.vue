<script setup lang="ts">
import { SPEED_RANGES } from '../composables/useSpeed'

const startHour = defineModel<number>('startHour', { required: true })
const endHour = defineModel<number>('endHour', { required: true })
const kmDay = defineModel<number>('kmDay', { required: true })

// Read-only feedback of the derived made-good speed (computed in the parent).
defineProps<{ madeGoodKmh: number }>()

function clamp(raw: string, min: number, max: number, fallback: number): number {
  const n = parseFloat(raw)
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n))
}
// Keep the window valid: start strictly before end (≥1h wide).
function onStart(e: Event) {
  const el = e.target as HTMLInputElement
  const v = clamp(el.value, SPEED_RANGES.startHour.min, endHour.value - 1, startHour.value)
  startHour.value = v
  el.value = String(v)
}
function onEnd(e: Event) {
  const el = e.target as HTMLInputElement
  const v = clamp(el.value, startHour.value + 1, SPEED_RANGES.endHour.max, endHour.value)
  endHour.value = v
  el.value = String(v)
}
function onKmDay(e: Event) {
  const el = e.target as HTMLInputElement
  const v = clamp(el.value, SPEED_RANGES.kmDay.min, SPEED_RANGES.kmDay.max, kmDay.value)
  kmDay.value = v
  el.value = String(v)
}
</script>

<template>
  <section class="speed">
    <div class="row">
      <span class="label">Day</span>
      <label class="fld">
        <input :value="startHour" type="number" step="1" min="0" max="22" inputmode="numeric" @change="onStart" />
        <span class="unit">start h</span>
      </label>
      <label class="fld">
        <input :value="endHour" type="number" step="1" min="2" max="24" inputmode="numeric" @change="onEnd" />
        <span class="unit">end h</span>
      </label>
    </div>
    <div class="row">
      <span class="label">Pace</span>
      <label class="fld">
        <input :value="kmDay" type="number" step="1" min="5" max="60" inputmode="numeric" @change="onKmDay" />
        <span class="unit">km/day</span>
      </label>
      <span class="readout">→ {{ madeGoodKmh.toFixed(1) }} km/h · ETAs only</span>
    </div>
  </section>
</template>

<style scoped>
.speed {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 6%, transparent);
}
.row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.label {
  flex: 0 0 2.5rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.fld {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  opacity: 0.85;
}
.fld input {
  width: 3rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  border-radius: 0.35rem;
  background: transparent;
  color: inherit;
  font-size: 0.8rem;
}
.unit { opacity: 0.6; }
.readout {
  font-size: 0.78rem;
  opacity: 0.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
