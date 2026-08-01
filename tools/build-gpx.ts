import fs from "fs";
import { label } from "./poi-labels";
import { DIARY, DIARY_B, BASE_GPX, FIELD_GPX } from "./paths";

// Layers the plan camps onto kungsleden-base.gpx (the raw export's track + POIs),
// producing ONE file with both plans' overnight stops as waypoints. Days 1–3 and
// the Abisko finish are identical in both plans (one waypoint); Days 4–17 differ,
// so each gets an "A ·" and a "B ·" waypoint. Camp coords come from diary.csv (A)
// and diary-B.csv (B) — regenerate those (npm run diary / diary:md:b) if the plan
// changes, then re-run this. The Tjulträsk detour line is intentionally NOT drawn
// (clear enough on the map); only the stops differ between plans.

const BASE = BASE_GPX;
const OUT = FIELD_GPX;

// RFC-4180 CSV parse (same helper as build-diary.ts)
function parseCSV(text: string, delim: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows.filter((r) => r.some((x) => x !== "")).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (s?: string) => String(parseFloat((s ?? "").replace(",", ".")));

type Camp = { km: string; lat: string; lon: string };
function camps(csv: string): Map<number, Camp> {
  const m = new Map<number, Camp>();
  for (const r of parseCSV(fs.readFileSync(csv, "utf8"), ";")) {
    if (r.type === "divider" || (r.overnight || "").trim() !== "x") continue;
    const cm = /Camp Day (\d+)/.exec(r.name);
    const day = cm ? Number(cm[1]) : r.name === "Abisko" ? 18 : 0;
    if (day) m.set(day, { km: n(r.from_start), lat: n(r.lat), lon: n(r.lon) });
  }
  return m;
}

const A = camps(DIARY);
const B = camps(DIARY_B);

const wpts: string[] = [];
const wpt = (c: Camp, name: string) =>
  wpts.push(`  <wpt lat="${c.lat}" lon="${c.lon}">`, `    <name>${x(name)}</name>`, `    <sym>Campground</sym>`, `  </wpt>`);

for (let day = 1; day <= 18; day++) {
  const a = A.get(day);
  if (!a) continue;
  if (day <= 3) wpt(a, `🌙 D${day} · km${a.km}`);                 // shared (ease-in)
  else if (day === 18) wpt(a, `🌙 Finish · Abisko · km${a.km}`);  // shared
  else {                                                          // Days 4–17 differ
    wpt(a, `🌙 A · D${day} · km${a.km}`);
    const b = B.get(day);
    if (b) wpt(b, `🌙 B · D${day} · km${b.km}`);
  }
}

// --- extra diary layers the Naturkartan export lacks (approved 2026-07-30) ---
// saunas (14), boat crossings (8), shops/resupply (16), the Kebnats↔Vakkotavare bus.
const pin = (lat: string, lon: string, name: string, sym: string) =>
  wpts.push(`  <wpt lat="${lat}" lon="${lon}">`, `    <name>${x(name)}</name>`, `    <sym>${x(sym)}</sym>`, `  </wpt>`);
const LAYERS: Record<string, { emoji: string; sym: string; place: (s: string) => string }> = {
  sauna: { emoji: "🧼", sym: "Lodging",         place: (s) => s.replace(/^Sauna\s+/i, "") },
  boat:  { emoji: "⛴️", sym: "Anchor",          place: (s) => s.replace(/^M\/S\s+/i, "").replace(/\s+(boat|ferry)$/i, "") },
  shop:  { emoji: "🛒", sym: "Shopping Center", place: (s) => s.replace(/^(Shop|ICA Nära)\s+/i, "") },
  bus:   { emoji: "🚌", sym: "Bus",             place: (s) => s.replace(/^Bus\s+/i, "") },
};
let extra = 0;
for (const r of parseCSV(fs.readFileSync(DIARY, "utf8"), ";")) {
  const spec = LAYERS[r.type];
  if (!spec || !r.lat || !r.lon) continue;
  if (Number(n(r.from_start)) >= 461) continue;  // route is ~460 km; skip the post-hike transport tail (train/transfer)
  pin(n(r.lat), n(r.lon), `${spec.emoji} ${spec.place(r.name)}`, spec.sym);
  extra++;
}

// Water warnings — fill-up points before the two dry above-tree-line plateau carries.
const WATER = [
  { lat: "67.14867", lon: "18.30590", name: "💧 Aktse — fill up" },  // dry plateau to Sitojaure (~6–8 km)
];
for (const w of WATER) { pin(w.lat, w.lon, w.name, "Drinking Water"); extra++; }

// Base POI categories to drop: Sauna (the diary layer provides all 14 as SN-*) + winter/info noise.
const DROP = ["Sauna", "Snowmobile Ban", "Quiet places", "Valuable nature", "Restricted area", "Bird watching", "Top", "Attraction", "Hiking", "Entrance", "Nature reserve", "Culture", "Fishing", "Nature Center"];
let base = fs.readFileSync(BASE, "utf8");
const dropRe = new RegExp(`  <wpt\\b[^\\n]*>\\n    <name>(?:${DROP.join("|")}) – [^<]*</name>[\\s\\S]*?  </wpt>\\n`, "g");
base = base.replace(dropRe, "");
// Emoji-label the remaining base POI titles ("Category – Name" -> "<emoji> <place>").
base = base.replace(/<name>([^<]* – [^<]*)<\/name>/g, (_m, nm) => `<name>${x(label(nm))}</name>`);
fs.writeFileSync(OUT, base.replace("</gpx>", wpts.join("\n") + "\n</gpx>"));
const nCamps = wpts.filter((l) => l.includes("<wpt ")).length - extra;
console.log(`${OUT}: base (emoji-labelled, ${DROP.length - 1} cats trimmed) + ${nCamps} camps + ${extra} diary pins`);
