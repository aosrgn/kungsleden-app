import { ref, watch } from 'vue'

// A persisted log of camp marks — the trail km + timestamp captured at each overnight
// stop. Distances between consecutive marks are the daily distances; the last mark's day
// runs to the current position, which is the live "km done today". Kept in localStorage.
//
// This is a JOURNAL, nothing more. It deliberately feeds no projection: deriving a km/day
// from it and extrapolating was what made the finish read "risks flight" while running
// ahead of Plan A's ease-in. Forgetting to mark now costs you history, not correctness.

const KEY = 'kungsleden.daylog'

export interface DayMark {
  km: number
  at: number // epoch ms
}

// Marks made on days 1–4 of the trek, reconstructed from the running totals on screen
// (camp 1 km 8.4 · camp 2 km 25.1 · camp 3 km 47.5, plus the km-0 trailhead on Aug 2 that
// was never tapped). Only applied to an EMPTY log, so the phone's own history — which
// survived the day-log removal, being localStorage and not code — always wins.
const SEED: DayMark[] = [
  { km: 0, at: new Date(2026, 7, 2, 14, 0).valueOf() },
  { km: 8.4, at: new Date(2026, 7, 3, 9, 0).valueOf() },
  { km: 25.1, at: new Date(2026, 7, 4, 9, 0).valueOf() },
  { km: 47.5, at: new Date(2026, 7, 5, 9, 0).valueOf() },
]

function load(): DayMark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return [...SEED]
    const ok = raw.filter((m): m is DayMark => m && Number.isFinite(m.km) && Number.isFinite(m.at))
    return ok.length ? ok : [...SEED]
  } catch {
    return [...SEED]
  }
}

export function useDayLog() {
  const marks = ref<DayMark[]>(load())

  watch(
    marks,
    () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(marks.value))
      } catch {
        // storage disabled — marks just won't persist
      }
    },
    { deep: true },
  )

  function mark(km: number, at: number) {
    marks.value.push({ km, at })
    marks.value.sort((a, b) => a.at - b.at)
  }
  // Correcting a camp after the fact: you tapped "Mark camp" an hour up the trail, or
  // forgot until the evening. The km is the only thing worth editing — the date is what
  // slots the row into the right trek day.
  function setKm(i: number, km: number) {
    const m = marks.value[i]
    if (m && Number.isFinite(km)) m.km = Math.max(0, km)
  }
  function remove(i: number) {
    if (i >= 0 && i < marks.value.length) marks.value.splice(i, 1)
  }
  function undo() {
    marks.value.pop()
  }

  function clear() {
    marks.value = []
  }

  return { marks, mark, setKm, remove, undo, clear }
}
