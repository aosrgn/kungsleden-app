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

function load(): { paceKmh: number; hoursPerDay: number } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      paceKmh: typeof s.paceKmh === 'number' ? s.paceKmh : 3.5,
      hoursPerDay: typeof s.hoursPerDay === 'number' ? s.hoursPerDay : 7.5,
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
