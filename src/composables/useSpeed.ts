import { ref, watch } from 'vue'

// The speed inputs: a daily walking window (start/end hour) and the km/day you expect to
// cover. Made-good speed derives as kmDay ÷ window; it drives ETAs and the POI crossing
// times. It deliberately does NOT drive the finish projection — that is plan-relative
// (OnTimePanel), so no pace estimate can throw it off. Persisted to localStorage.

const KEY = 'kungsleden.speed'

export const SPEED_RANGES = {
  startHour: { min: 0, max: 22, dflt: 8 },
  endHour: { min: 2, max: 24, dflt: 18 },
  kmDay: { min: 5, max: 60, dflt: 25 },
} as const

function validNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function load(): { startHour: number; endHour: number; kmDay: number } {
  const r = SPEED_RANGES
  const d = { startHour: r.startHour.dflt, endHour: r.endHour.dflt, kmDay: r.kmDay.dflt }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      startHour: validNum(s.startHour, r.startHour.min, r.startHour.max, d.startHour),
      endHour: validNum(s.endHour, r.endHour.min, r.endHour.max, d.endHour),
      // `seedKmDay` is the pre-day-log key name — read it so a phone that already has
      // settings stored keeps its number instead of silently resetting to 25.
      kmDay: validNum(s.kmDay ?? s.seedKmDay, r.kmDay.min, r.kmDay.max, d.kmDay),
    }
  } catch {
    return d
  }
}

export function useSpeed() {
  const init = load()
  const startHour = ref(init.startHour)
  const endHour = ref(init.endHour)
  const kmDay = ref(init.kmDay)

  watch([startHour, endHour, kmDay], () => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ startHour: startHour.value, endHour: endHour.value, kmDay: kmDay.value }),
      )
    } catch {
      // storage disabled — inputs just won't persist
    }
  })

  return { startHour, endHour, kmDay }
}
