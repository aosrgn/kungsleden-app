import fs from "fs";
import { DIARY, GEOJSON } from "./paths";

// Reads diary.csv, projects each located row onto the route line for km-from-start,
// computes all distance columns, assigns an icon per row, and writes back a
// EUROPEAN-format CSV: semicolon-delimited, comma decimals, with a divider row
// after every overnight so days read as blocks in Numbers.
//
// INPUT columns you maintain: name, type, date, overnight, crossed_km, from_start, lat, lon, shop_size, buy_here, notes, source, url
//   - lat/lon for a located feature (km computed) OR from_start (km) for a camp (coords computed)
//   - crossed_km only on boat/bus rows = the not-hiked length of that segment
//   - overnight = "x" where you sleep
//   - shop_size (hut rows) = village | large | small | none — resupply available at that stop
//   - buy_here (resupply rows) = meals to buy to reach the next shop, e.g. "3B 2L 2D"
// AUTO columns (don't hand-edit): icon, from_start, to_next_hut, hiked, not_hiked, total, to_next_food, to_next_sauna

const CSV = process.argv[2] || DIARY;
const OUT_DELIM = ";"; // European CSV
const NUMERIC = new Set(["from_start", "to_next_hut", "hiked", "not_hiked", "total", "to_next_food", "to_next_sauna", "crossed_km", "lat", "lon"]);
const COLS = ["icon", "name", "type", "date", "overnight", "from_start", "to_next_hut", "hiked", "not_hiked", "total", "to_next_food", "to_next_sauna", "crossed_km", "lat", "lon", "shop_size", "buy_here", "recharge", "wifi", "laundry", "card", "notes", "source", "url"];

const ICON: Record<string, string> = {
  hut: "🏠", shelter: "🛖", boat: "⛵", bus: "🚌", sauna: "♨️", shop: "🛒", restaurant: "🍽️", landmark: "📍",
  train: "🚆", flight: "✈️", hotel: "🏨",
};
function iconFor(r: Record<string, string>): string {
  if ((r.overnight || "").toLowerCase() === "x") return "🌙"; // sleep
  return ICON[r.type] || "•";
}

// ---------- CSV (delimiter-aware, RFC-4180 quoting) ----------
function parseCSV(text: string, delim: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows.filter((r) => r.some((x) => x !== "")).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}
const esc = (v: string) => { v = v ?? ""; return v.includes('"') || v.includes("\n") || v.includes(OUT_DELIM) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const fmt = (col: string, v: string) => esc(NUMERIC.has(col) && v ? v.replace(".", ",") : v ?? "");
const num = (x: string) => { const v = parseFloat((x ?? "").replace(",", ".")); return isNaN(v) ? null : v; };

// ---------- geometry ----------
const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
function hav(aLon: number, aLat: number, bLon: number, bLat: number) {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const fc = JSON.parse(fs.readFileSync(GEOJSON, "utf8"));
const lineFeat = fc.features.find((f: any) => f.geometry?.type === "LineString" && f.properties?.type === "trail");
if (!lineFeat) throw new Error("No trail LineString found in " + GEOJSON);
const line: number[][] = lineFeat.geometry.coordinates;
const cum: number[] = [0];
for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + hav(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
const TOTAL = cum[cum.length - 1];

function project(lon: number, lat: number): { along: number; offset: number } {
  let best = { d: Infinity, along: 0 };
  const mLat = 110540, mLon = 111320 * Math.cos(rad(lat));
  for (let i = 0; i < line.length - 1; i++) {
    const A = line[i], B = line[i + 1];
    const bx = (B[0] - A[0]) * mLon, by = (B[1] - A[1]) * mLat;
    const px = (lon - A[0]) * mLon, py = (lat - A[1]) * mLat;
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const d = Math.hypot(px - t * bx, py - t * by);
    if (d < best.d) best = { d, along: cum[i] + t * (cum[i + 1] - cum[i]) };
  }
  return { along: best.along, offset: best.d / 1000 };
}
function locate(km: number): [number, number] {
  if (km <= 0) return [line[0][0], line[0][1]];
  if (km >= TOTAL) return [line[line.length - 1][0], line[line.length - 1][1]];
  let i = 1; while (i < cum.length && cum[i] < km) i++;
  const t = (km - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])];
}

// ---------- load (detect delimiter; strip generated divider rows) ----------
const raw = fs.readFileSync(CSV, "utf8");
const DELIM = raw.split("\n")[0].includes(";") ? ";" : ",";
const rows = parseCSV(raw, DELIM).filter((r) => r.type !== "divider");
for (const r of rows) for (const k of NUMERIC) if (r[k]) r[k] = r[k].replace(",", "."); // normalise to dot internally

for (const r of rows) {
  const lat = num(r.lat), lon = num(r.lon), fsg = num(r.from_start);
  if (fsg != null && fsg > TOTAL) {
    // post-trail logistics (train/flight): keep explicit from_start + coords as-is, sort last
  } else if (lat != null && lon != null) {
    const p = project(lon, lat);
    r.from_start = p.along.toFixed(1);
    if (p.offset > 2) console.warn(`  ⚠ ${r.name}: ${p.offset.toFixed(1)} km off the route line — check coords`);
  } else if (num(r.from_start) != null) {
    const [L, La] = locate(num(r.from_start)!);
    r.lon = L.toFixed(5); r.lat = La.toFixed(5);
  } else { console.warn(`  ⚠ ${r.name}: no coords and no from_start`); r.from_start = ""; }
}
rows.sort((a, b) => (num(a.from_start) ?? 1e9) - (num(b.from_start) ?? 1e9));

function fillToNext(pred: (r: Record<string, string>) => boolean, col: string) {
  const idx = rows.map((r, i) => (pred(r) ? i : -1)).filter((i) => i >= 0);
  rows.forEach((r) => (r[col] = ""));
  for (let k = 0; k < idx.length - 1; k++)
    rows[idx[k]][col] = (num(rows[idx[k + 1]].from_start)! - num(rows[idx[k]].from_start)!).toFixed(1);
}
fillToNext((r) => r.type === "hut", "to_next_hut");
fillToNext((r) => r.type === "shop" || r.type === "restaurant", "to_next_food");
fillToNext((r) => r.type === "sauna", "to_next_sauna");

rows.forEach((r) => { r.hiked = r.not_hiked = r.total = ""; });
let prevFrom = 0, prevPos = -1;
rows.forEach((r, i) => {
  if ((r.overnight || "").toLowerCase() !== "x") return;
  const here = num(r.from_start)!;
  let notHiked = 0;
  for (let j = prevPos + 1; j <= i; j++) notHiked += num(rows[j].crossed_km) ?? 0;
  const total = here - prevFrom;
  r.total = total.toFixed(1); r.not_hiked = notHiked.toFixed(1); r.hiked = (total - notHiked).toFixed(1);
  prevFrom = here; prevPos = i;
});

// ---------- write (icons + day-divider rows + European numbers) ----------
const out: Record<string, string>[] = [];
for (const r of rows) {
  r.icon = iconFor(r);
  out.push(r);
  if ((r.overnight || "").toLowerCase() === "x")
    out.push({ icon: "🌙", type: "divider", name: `──────────  ${r.date || "night"}  ──────────` });
}
const lines = [COLS.join(OUT_DELIM), ...out.map((r) => COLS.map((c) => fmt(c, r[c] ?? "")).join(OUT_DELIM))];
fs.writeFileSync(CSV, lines.join("\n") + "\n");

const overs = rows.filter((r) => (r.overnight || "").toLowerCase() === "x");
const sH = overs.reduce((s, r) => s + (num(r.hiked) ?? 0), 0);
const sN = overs.reduce((s, r) => s + (num(r.not_hiked) ?? 0), 0);
console.log(`diary.csv: ${rows.length} rows + ${overs.length} day-dividers · route ${TOTAL.toFixed(1)} km`);
console.log(`hiked ${sH.toFixed(0)} + not-hiked ${sN.toFixed(0)} = ${(sH + sN).toFixed(0)} km · delimiter ";" · comma decimals`);
