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

// The plan's daily walking window: you sit at the previous camp overnight, then walk
// from WALK_START to WALK_END. Anchoring camp arrival at 18:00 (not midnight) and
// modeling the overnight as stationary is what keeps "where should I be now" correct
// in the morning, not just at the evening camp.
const WALK_START_MS = 8 * 3600 * 1000
const ARRIVAL_MS = 18 * 3600 * 1000

// Where Plan A expects you to be (km) at a given moment: 0 at the first day's start,
// climbing only during each day's walking window and flat overnight at each camp,
// clamped to the finish. Comparing this to your actual km gives an artifact-free
// ahead/behind at any time of day.
export function plannedKmAtTime(stops: PlanStop[], now: Date): number | null {
  if (!stops.length) return null
  const pts: { t: number; km: number }[] = [{ t: stops[0].date.valueOf() + WALK_START_MS, km: 0 }]
  for (let i = 0; i < stops.length; i++) {
    pts.push({ t: stops[i].date.valueOf() + ARRIVAL_MS, km: stops[i].km }) // camp reached (18:00)
    if (i < stops.length - 1) {
      pts.push({ t: stops[i + 1].date.valueOf() + WALK_START_MS, km: stops[i].km }) // still at camp next morning
    }
  }
  const t = now.valueOf()
  if (t <= pts[0].t) return pts[0].km
  const last = pts[pts.length - 1]
  if (t >= last.t) return last.km
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const a = pts[i - 1]
      const b = pts[i]
      return a.km + ((t - a.t) / (b.t - a.t)) * (b.km - a.km)
    }
  }
  return last.km
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
