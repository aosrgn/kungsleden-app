// Loads the baked-in trip data: the diary (plan + POIs, one authoritative CSV) and
// the trail geometry (the LineString from the geojson). Both are bundled in public/data/.
// diary.csv is European-format: ';'-delimited, comma decimals — parsed to dot-decimal
// numbers here.

export type TrailPoint = [number, number] // [lng, lat]

export interface DiaryRow {
  icon: string
  name: string
  type: string
  date: string
  overnight: boolean
  fromStart: number | null // km from the Hemavan trailhead
  lat: number | null
  lon: number | null
  toNextHut: number | null
  crossedKm: number | null // not-hiked length of a boat/bus segment
  hiked: number | null
  notHiked: number | null
  total: number | null
  notes: string
}

export interface Trip {
  diary: DiaryRow[]
  trail: TrailPoint[]
}

// RFC-4180 parse, delimiter-aware — same shape as the data/ build scripts.
function parseCSV(text: string, delim: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  const header = (rows.shift() ?? []).map((h) => h.trim())
  return rows
    .filter((r) => r.some((x) => x !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const num = (s?: string): number | null => {
  const v = parseFloat((s ?? '').replace(',', '.'))
  return Number.isNaN(v) ? null : v
}

export function parseDiary(csvText: string): DiaryRow[] {
  return parseCSV(csvText, ';')
    .filter((r) => r.type !== 'divider')
    .map((r) => ({
      icon: r.icon ?? '',
      name: r.name ?? '',
      type: r.type ?? '',
      date: r.date ?? '',
      overnight: (r.overnight ?? '').toLowerCase() === 'x',
      fromStart: num(r.from_start),
      lat: num(r.lat),
      lon: num(r.lon),
      toNextHut: num(r.to_next_hut),
      crossedKm: num(r.crossed_km),
      hiked: num(r.hiked),
      notHiked: num(r.not_hiked),
      total: num(r.total),
      notes: r.notes ?? '',
    }))
}

interface GeoFeature {
  geometry: { type: string; coordinates: unknown }
  properties?: { type?: string }
}

export function extractTrail(geojson: { features: GeoFeature[] }): TrailPoint[] {
  const feat = geojson.features.find(
    (f) => f.geometry?.type === 'LineString' && f.properties?.type === 'trail',
  )
  if (!feat) throw new Error('No trail LineString found in geojson')
  return feat.geometry.coordinates as TrailPoint[]
}

async function fetchOk(url: string): Promise<Response> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r
}

export async function loadTrip(): Promise<Trip> {
  const base = import.meta.env.BASE_URL
  const [csv, gj] = await Promise.all([
    fetchOk(`${base}data/diary.csv`).then((r) => r.text()),
    fetchOk(`${base}data/kungsleden.geojson`).then((r) => r.json()),
  ])
  return { diary: parseDiary(csv), trail: extractTrail(gj) }
}
