import type { DiaryRow } from './data/trip'

// Plan A schedule derived from the diary: the dated overnight stops (km + date) and
// the huts along the route. Used to answer "where does the plan have me tonight" and
// "what do I pass on the way". Dates are parsed as LOCAL calendar days so day-matching
// isn't shifted by the device timezone.

export interface PlanStop {
  date: Date // local midnight of the planned overnight
  km: number
  name: string
}

export interface Hut {
  km: number
  name: string
  icon: string
}

function parseLocalDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// Camps carry only a date, but are reached in the evening; anchor the planned
// arrival at this hour so "ahead/behind Plan A" reads ~0 when you're at a camp on
// its day, instead of a full day off from a midnight anchor.
const ARRIVAL_MS = 18 * 3600 * 1000

// The datetime the plan has you reaching a given km, linearly interpolated between
// the overnight knots (each one calendar day apart, anchored at ARRIVAL_MS). Clamped
// to the first/last stop outside the route. Used for "how far ahead/behind Plan A".
export function plannedArrivalAtKm(stops: PlanStop[], km: number): Date | null {
  if (!stops.length) return null
  const at = (s: PlanStop) => s.date.valueOf() + ARRIVAL_MS
  if (km <= stops[0].km) return new Date(at(stops[0]))
  const last = stops[stops.length - 1]
  if (km >= last.km) return new Date(at(last))
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (km <= b.km) {
      const f = (km - a.km) / (b.km - a.km)
      return new Date(at(a) + f * (at(b) - at(a)))
    }
  }
  return new Date(at(last))
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function planStops(diary: DiaryRow[]): PlanStop[] {
  const out: PlanStop[] = []
  for (const r of diary) {
    if (!r.overnight || r.fromStart == null || !r.date) continue
    const date = parseLocalDay(r.date)
    if (date) out.push({ date, km: r.fromStart, name: r.name })
  }
  return out.sort((a, b) => a.km - b.km)
}

export function huts(diary: DiaryRow[]): Hut[] {
  return diary
    .filter((r) => r.type === 'hut' && r.fromStart != null)
    .map((r) => ({ km: r.fromStart as number, name: r.name, icon: r.icon }))
    .sort((a, b) => a.km - b.km)
}

export function stopForDay(stops: PlanStop[], now: Date): PlanStop | null {
  return stops.find((s) => sameLocalDay(s.date, now)) ?? null
}

export type TrekPhase = 'pre' | 'active' | 'post' | 'unknown'

export function trekPhase(stops: PlanStop[], now: Date): TrekPhase {
  if (!stops.length) return 'unknown'
  if (stopForDay(stops, now)) return 'active'
  const today = startOfDay(now)
  if (today < startOfDay(stops[0].date)) return 'pre'
  if (today > startOfDay(stops[stops.length - 1].date)) return 'post'
  return 'unknown'
}
