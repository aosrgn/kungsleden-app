<script setup lang="ts">
import { PACE_PRESETS } from '../composables/usePace'

const paceKmh = defineModel<number>('paceKmh', { required: true })
const hoursPerDay = defineModel<number>('hoursPerDay', { required: true })

// Commit custom inputs only as valid, clamped numbers (on change/blur), so the
// models never hold '' / NaN / out-of-range values that downstream math would trust.
function clamp(raw: string, min: number, max: number, fallback: number): number {
  const n = parseFloat(raw)
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n))
}
function onPace(e: Event) {
  paceKmh.value = clamp((e.target as HTMLInputElement).value, 1, 8, paceKmh.value)
}
function onHours(e: Event) {
  hoursPerDay.value = clamp((e.target as HTMLInputElement).value, 1, 16, hoursPerDay.value)
}
</script>

<template>
  <section class="pace">
    <div class="row">
      <span class="label">Pace</span>
      <div class="presets">
        <button
          v-for="p in PACE_PRESETS"
          :key="p.kmh"
          :class="{ on: paceKmh === p.kmh }"
          @click="paceKmh = p.kmh"
        >
          {{ p.label }}
        </button>
        <label class="custom">
          <input :value="paceKmh" type="number" step="0.1" min="1" max="8" inputmode="decimal" @change="onPace" />
          km/h
        </label>
      </div>
    </div>
    <div class="row">
      <span class="label">Hours/day</span>
      <label class="custom">
        <input :value="hoursPerDay" type="number" step="0.5" min="1" max="16" inputmode="decimal" @change="onHours" />
        h
      </label>
    </div>
  </section>
</template>

<style scoped>
.pace {
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
}
.label {
  flex: 0 0 4.5rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.presets {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
button {
  padding: 0.3rem 0.6rem;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  background: transparent;
  color: inherit;
  border-radius: 1rem;
  font-size: 0.8rem;
  cursor: pointer;
}
button.on {
  background: #0a3d2e;
  border-color: #0a3d2e;
  color: #f4f1ea;
}
.custom {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  opacity: 0.85;
}
.custom input {
  width: 3.2rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  border-radius: 0.35rem;
  background: transparent;
  color: inherit;
  font-size: 0.8rem;
}
</style>
