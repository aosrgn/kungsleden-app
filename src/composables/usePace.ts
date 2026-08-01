import { ref, watch } from 'vue'

// Expected walking pace (km/h) and walking hours per day — the two inputs that
// drive ETAs and the finish projection. Persisted to localStorage so a pace set
// in the field survives a reload. This is UI state, not the cut data-storage layer.

const KEY = 'kungsleden.pace'

export const PACE_PRESETS = [
  { label: 'Slow', kmh: 3.0 },
  { label: 'Normal', kmh: 3.5 },
  { label: 'Fast', kmh: 4.0 },
]

// Valid input ranges (mirror PaceControl's <input min/max>). Enforced here too so
// a corrupted/hand-edited localStorage value can't feed 0/negative/NaN into the
// pace-driven math (ETAs, finish projection) before any UI interaction clamps it.
const PACE_MIN = 1, PACE_MAX = 8
const HOURS_MIN = 1, HOURS_MAX = 16

function validNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function load(): { paceKmh: number; hoursPerDay: number } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      paceKmh: validNum(s.paceKmh, PACE_MIN, PACE_MAX, 3.5),
      hoursPerDay: validNum(s.hoursPerDay, HOURS_MIN, HOURS_MAX, 7.5),
    }
  } catch {
    return { paceKmh: 3.5, hoursPerDay: 7.5 }
  }
}

export function usePace() {
  const initial = load()
  const paceKmh = ref(initial.paceKmh)
  const hoursPerDay = ref(initial.hoursPerDay)

  watch([paceKmh, hoursPerDay], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ paceKmh: paceKmh.value, hoursPerDay: hoursPerDay.value }))
    } catch {
      // private mode / storage disabled — pace just won't persist, no functional loss
    }
  })

  return { paceKmh, hoursPerDay }
}
