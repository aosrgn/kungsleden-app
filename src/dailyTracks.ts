import type { TrailIndex } from './trail'
import type { NightCamp } from './plan'
import { addDays, startOfDay } from './plan'

// Rebuilds one GPX *track* per walking day from the trail line and the day log, so the
// trek can be imported into Apple Health (via RunGap or similar) as real hikes with a
// route on the map. The field GPX can't do this: it's a planned route with waypoints and
// no time data, and a workout needs timestamps.
//
// The timestamps here are RECONSTRUCTED, not recorded — every day is laid out at a
// constant pace between the two camps you actually slept at, spread across your walking
// window. Honest as a personal record of ground you genuinely covered; not a GPS trace,
// so don't feed these to anything that treats them as measured (segments, leaderboards).

export interface DailyTrack {
  day: number
  date: Date
  fromKm: number
  toKm: number
  km: number
  fileName: string
  gpx: string
}

const iso = (d: Date) => new Date(d.getTime() - d.getMilliseconds()).toISOString().replace(/\.\d{3}Z$/, 'Z')
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildGpx(name: string, pts: { lat: number; lng: number; at: Date }[]): string {
  const trkpts = pts
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><time>${iso(p.at)}</time></trkpt>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kungsleden planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${iso(pts[0].at)}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <type>hiking</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
}

export interface DailyTrackOptions {
  trail: TrailIndex
  camps: NightCamp[]
  trekStart: Date | null
  startHour: number
  endHour: number
  /**
   * Where the trek ended, for the closing day — the one that finishes at Abisko rather
   * than at a camp, so the day log has no mark for it. Taken from your position, which
   * the "simulate km" field can override once you're home and off the trail.
   */
  finishKm?: number | null
}

export function dailyTracks(o: DailyTrackOptions): DailyTrack[] {
  if (!o.trekStart || !o.camps.length) return []

  // Each night camp closes a day: day n runs from the previous camp (or the km-0
  // trailhead) to this one. A finish km beyond the last camp adds the closing day.
  const legs: { day: number; fromKm: number; toKm: number }[] = []
  let prevKm = 0
  for (const c of o.camps) {
    legs.push({ day: c.night, fromKm: prevKm, toKm: c.km })
    prevKm = c.km
  }
  const lastNight = o.camps[o.camps.length - 1].night
  if (o.finishKm != null && o.finishKm - prevKm > 1) {
    legs.push({ day: lastNight + 1, fromKm: prevKm, toKm: o.finishKm })
  }

  const hours = Math.max(1, o.endHour - o.startHour)
  return legs.flatMap((leg) => {
    const km = leg.toKm - leg.fromKm
    if (km < 0.1) return []
    const pts = o.trail.slice(leg.fromKm, leg.toKm)
    if (pts.length < 2) return []

    const date = addDays(o.trekStart as Date, leg.day - 1)
    const dayStart = startOfDay(date).valueOf() + o.startHour * 3600000
    // Constant pace across the walking window, so each point's time follows its distance.
    const timed = pts.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      at: new Date(dayStart + ((p.km - leg.fromKm) / km) * hours * 3600000),
    }))

    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const name = `Kungsleden D${leg.day} · ${stamp} · ${km.toFixed(1)} km`
    return [
      {
        day: leg.day,
        date,
        fromKm: leg.fromKm,
        toKm: leg.toKm,
        km,
        fileName: `kungsleden-d${String(leg.day).padStart(2, '0')}-${stamp}.gpx`,
        gpx: buildGpx(name, timed),
      },
    ]
  })
}
