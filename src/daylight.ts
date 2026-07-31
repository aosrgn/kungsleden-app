// Local sunrise/sunset + daylight-remaining from position and date. Compact port of
// the standard sunrise-equation / SunCalc math (no dependency). Handles the polar
// cases (midnight sun / polar night) that occur at these latitudes off-season and the
// pre-dawn window; during the trek (early–mid August at ~66–68°N) the sun sets normally.

const rad = Math.PI / 180
const dayMs = 86400000
const J1970 = 2440588
const J2000 = 2451545
const obliquity = rad * 23.4397
const J0 = 0.0009
const SUNSET_ANGLE = rad * -0.833 // sun's upper limb at the horizon incl. refraction

const toDays = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs)
const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d)
const declination = (L: number) => Math.asin(Math.sin(L) * Math.sin(obliquity))
const solarTransitJ = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

function eclipticLongitude(M: number): number {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const perihelion = rad * 102.9372
  return M + C + perihelion + Math.PI
}

export type Daylight =
  | { status: 'day'; minutesLeft: number; sunset: Date }
  | { status: 'before-sunrise'; sunrise: Date }
  | { status: 'after-sunset'; sunset: Date }
  | { status: 'midnight-sun' }
  | { status: 'polar-night' }

export function daylight(lat: number, lng: number, now: Date): Daylight {
  const lw = rad * -lng
  const phi = rad * lat
  const d = toDays(now)
  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = J0 + lw / (2 * Math.PI) + n // approximate solar transit (hour angle 0)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L)

  const cosH = (Math.sin(SUNSET_ANGLE) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cosH < -1) return { status: 'midnight-sun' }
  if (cosH > 1) return { status: 'polar-night' }

  const w = Math.acos(cosH)
  const jNoon = solarTransitJ(ds, M, L)
  const jSet = solarTransitJ(J0 + (w + lw) / (2 * Math.PI) + n, M, L)
  const sunset = fromJulian(jSet)
  const sunrise = fromJulian(2 * jNoon - jSet) // symmetric about solar noon
  const t = now.valueOf()

  if (t < sunrise.valueOf()) return { status: 'before-sunrise', sunrise } // still dark before dawn
  const minutesLeft = Math.round((sunset.valueOf() - t) / 60000)
  return minutesLeft <= 0 ? { status: 'after-sunset', sunset } : { status: 'day', minutesLeft, sunset }
}
