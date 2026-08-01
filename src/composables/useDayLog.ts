import { ref, watch } from 'vue'

// A persisted log of "day start" marks — the trail km + timestamp captured each
// morning. Distances between consecutive marks are the daily distances; the last
// mark's day runs to the current position. Kept in localStorage across reloads.

const KEY = 'kungsleden.daylog'

export interface DayMark {
  km: number
  at: number // epoch ms
}

function load(): DayMark[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (m): m is DayMark => m && Number.isFinite(m.km) && Number.isFinite(m.at),
    )
  } catch {
    return []
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
  }
  function undo() {
    marks.value.pop()
  }
  function clear() {
    marks.value = []
  }

  return { marks, mark, undo, clear }
}
