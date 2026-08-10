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

const HOUR_MS = 3600 * 1000

// The plan's timeline as (time, km) points: you sit at the previous camp overnight, then
// walk the day's ground between startHour and endHour. Modeling the overnight as
// stationary is what keeps "where should I be now" correct in the morning, not just at
// the evening camp. The window is YOUR window (from the speed control) — using a fixed
// 08:00 while you actually leave at 09:00 invents an hour of deficit every morning.
function planCurve(stops: PlanStop[], startHour: number, endHour: number) {
  const startMs = startHour * HOUR_MS
  const arrivalMs = Math.max(startHour + 1, endHour) * HOUR_MS
  const pts: { t: number; km: number }[] = [{ t: stops[0].date.valueOf() + startMs, km: 0 }]
  for (let i = 0; i < stops.length; i++) {
    pts.push({ t: stops[i].date.valueOf() + arrivalMs, km: stops[i].km }) // camp reached
    if (i < stops.length - 1) {
      pts.push({ t: stops[i + 1].date.valueOf() + startMs, km: stops[i].km }) // still at camp next morning
    }
  }
  return pts
}

// Where Plan A expects you to be (km) at a given moment: 0 at the first day's start,
// climbing only during each day's walking window and flat overnight at each camp,
// clamped to the finish. Comparing this to your actual km gives an artifact-free
// ahead/behind at any time of day.
export function plannedKmAtTime(
  stops: PlanStop[],
  now: Date,
  startHour: number,
  endHour: number,
): number | null {
  if (!stops.length) return null
  const pts = planCurve(stops, startHour, endHour)
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

// When Plan A sets off, and the moment it has you finishing (last camp, at the end hour).
export function planSpan(
  stops: PlanStop[],
  startHour: number,
  endHour: number,
): { start: Date; end: Date } | null {
  if (!stops.length) return null
  const pts = planCurve(stops, startHour, endHour)
  return { start: new Date(pts[0].t), end: new Date(pts[pts.length - 1].t) }
}

export interface PoiArrival {
  day: number // 1-based trek day this km falls on
  clockHours: number // planned arrival time-of-day, decimal hours (may exceed the end hour on a long day)
}

// Planned clock-time you'd cross a km per Plan A: each day starts at its overnight camp
// at startHour and you cover ground at speedKmh. The km belongs to the segment whose end
// camp is the first at/after it (day 1 runs from the km-0 trailhead). Note: applies the
// walking speed to the whole segment, so a boat/bus transfer day reads late.
export function poiArrival(
  stops: PlanStop[],
  km: number,
  startHour: number,
  speedKmh: number,
): PoiArrival | null {
  if (!stops.length || speedKmh <= 0) return null
  let i = stops.findIndex((s) => s.km >= km)
  if (i === -1) i = stops.length - 1
  const segStartKm = i === 0 ? 0 : stops[i - 1].km
  return { day: i + 1, clockHours: startHour + (km - segStartKm) / speedKmh }
}

export interface CampMark {
  km: number
  at: number // epoch ms
}

// A camp belongs to a NIGHT, and night n is the one that ended trek day n. Which night a
// mark records depends on the hour it was made: tap it in the morning and you're standing
// in the camp you just slept in, so it closed YESTERDAY; tap it on arrival in the evening
// and it closes TODAY. Keying off the date alone labels every evening mark a night early
// and stacks it onto a night that already has a camp.
const NIGHT_SPLIT_HOUR = 12
const DAY_MS = 86400000

export interface NightCamp {
  night: number // = the trek day this camp ended
  km: number
  at: number
  markIndex: number // back-reference for editing/removing the underlying mark
}

export function markNight(m: CampMark, trekStart: Date): number {
  const at = new Date(m.at)
  const day = Math.round((startOfDay(at).valueOf() - startOfDay(trekStart).valueOf()) / DAY_MS) + 1
  return at.getHours() < NIGHT_SPLIT_HOUR ? day - 1 : day
}

// One camp per night, latest mark wins — so re-marking corrects a night instead of
// duplicating it, and a stale auto-inserted trailhead row is superseded by the real camp.
export function campsByNight(marks: CampMark[], trekStart: Date | null): NightCamp[] {
  if (!trekStart) return []
  const byNight = new Map<number, NightCamp>()
  marks.forEach((m, markIndex) => {
    const night = markNight(m, trekStart)
    if (night < 1) return
    const prev = byNight.get(night)
    if (!prev || m.at >= prev.at) byNight.set(night, { night, km: m.km, at: m.at, markIndex })
  })
  return [...byNight.values()].sort((a, b) => a.night - b.night)
}

// Plan A's camps with each day's END camp replaced by where you ACTUALLY slept. Feeds the
// per-day POI crossing times, so each day is measured from the real camp rather than the
// planned one — camp 1.5 km past the planned spot and the whole day's clock shifts with
// you. Days you haven't slept keep their planned camp. Forced non-decreasing: overshooting
// a later planned camp must not run a day backwards.
export function realisedStops(stops: PlanStop[], camps: NightCamp[]): PlanStop[] {
  if (!camps.length) return stops
  const byNight = new Map(camps.map((c) => [c.night, c.km]))
  let prev = 0
  return stops.map((s, i) => {
    const km = Math.max(prev, byNight.get(i + 1) ?? s.km)
    prev = km
    return { ...s, km }
  })
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
