import type { TrailPoint } from './data/trip'

// Projects a GPS fix onto the trail LineString to get km-from-start — the same
// nearest-segment projection the data/ diary builder uses to place POIs, so the
// app's "current km" and the diary's POI km share one reference. Build the index
// once (precomputes cumulative km); project() is O(segments) per fix, fine for the
// ~8.4k-point line at watch cadence.

const rad = (x: number) => (x * Math.PI) / 180
const R = 6371

function haversineKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export interface TrailProjection {
  km: number // distance from start along the trail
  offsetKm: number // perpendicular distance from the trail line
}

export interface TrailPointAtKm {
  lat: number
  lng: number
  km: number
}

export interface TrailIndex {
  totalKm: number
  project(lat: number, lng: number): TrailProjection
  /** The trail between two km marks: interpolated endpoints plus every vertex between. */
  slice(fromKm: number, toKm: number): TrailPointAtKm[]
}

export function createTrailIndex(trail: TrailPoint[]): TrailIndex {
  const cum: number[] = [0]
  for (let i = 1; i < trail.length; i++) {
    cum[i] = cum[i - 1] + haversineKm(trail[i - 1][0], trail[i - 1][1], trail[i][0], trail[i][1])
  }
  const totalKm = cum[cum.length - 1] ?? 0

  function project(lat: number, lng: number): TrailProjection {
    // Local equirectangular metres — accurate enough for the nearest-segment search.
    const mLat = 110540
    const mLng = 111320 * Math.cos(rad(lat))
    let bestD = Infinity
    let bestKm = 0
    for (let i = 0; i < trail.length - 1; i++) {
      const A = trail[i]
      const B = trail[i + 1]
      const bx = (B[0] - A[0]) * mLng
      const by = (B[1] - A[1]) * mLat
      const px = (lng - A[0]) * mLng
      const py = (lat - A[1]) * mLat
      const len2 = bx * bx + by * by
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0
      const d = Math.hypot(px - t * bx, py - t * by)
      if (d < bestD) {
        bestD = d
        bestKm = cum[i] + t * (cum[i + 1] - cum[i])
      }
    }
    return { km: bestKm, offsetKm: bestD / 1000 }
  }

  // Position at a km mark, interpolated along the segment it falls in.
  function at(km: number): TrailPointAtKm {
    const t = Math.min(totalKm, Math.max(0, km))
    let i = 1
    while (i < cum.length - 1 && cum[i] < t) i++
    const a = trail[i - 1]
    const b = trail[i]
    const span = cum[i] - cum[i - 1]
    const f = span > 0 ? (t - cum[i - 1]) / span : 0
    return { lng: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, km: t }
  }

  function slice(fromKm: number, toKm: number): TrailPointAtKm[] {
    const lo = Math.min(totalKm, Math.max(0, fromKm))
    const hi = Math.min(totalKm, Math.max(0, toKm))
    if (hi - lo < 1e-6) return []
    const out: TrailPointAtKm[] = [at(lo)]
    for (let i = 0; i < trail.length; i++) {
      if (cum[i] > lo && cum[i] < hi) out.push({ lng: trail[i][0], lat: trail[i][1], km: cum[i] })
    }
    out.push(at(hi))
    return out
  }

  return { totalKm, project, slice }
}
