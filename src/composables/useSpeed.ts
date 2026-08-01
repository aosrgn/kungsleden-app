import { ref, watch } from 'vue'

// The unified speed inputs: a daily walking window (start/end hour) and a seed average
// km/day. avgKmDay is measured from the day-log; seedKmDay is the "day -1" prior it
// starts from (Plan A's ~25 km/day) and fades as real days log. made-good speed derives
// as avgKmDay ÷ window. Persisted to localStorage (UI state, not the cut data layer).

const KEY = 'kungsleden.speed'

export const SPEED_RANGES = {
  startHour: { min: 0, max: 22, dflt: 8 },
  endHour: { min: 2, max: 24, dflt: 18 },
  seedKmDay: { min: 5, max: 60, dflt: 25 },
} as const

function validNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function load(): { startHour: number; endHour: number; seedKmDay: number } {
  const d = { startHour: 8, endHour: 18, seedKmDay: 25 }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const r = SPEED_RANGES
    return {
      startHour: validNum(s.startHour, r.startHour.min, r.startHour.max, d.startHour),
      endHour: validNum(s.endHour, r.endHour.min, r.endHour.max, d.endHour),
      seedKmDay: validNum(s.seedKmDay, r.seedKmDay.min, r.seedKmDay.max, d.seedKmDay),
    }
  } catch {
    return d
  }
}

export function useSpeed() {
  const init = load()
  const startHour = ref(init.startHour)
  const endHour = ref(init.endHour)
  const seedKmDay = ref(init.seedKmDay)

  watch([startHour, endHour, seedKmDay], () => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ startHour: startHour.value, endHour: endHour.value, seedKmDay: seedKmDay.value }),
      )
    } catch {
      // storage disabled — inputs just won't persist
    }
  })

  return { startHour, endHour, seedKmDay }
}
