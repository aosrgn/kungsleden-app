import fs from "fs";
import { DIARY } from "./paths";

// Generates diary.md — a faithful, Apple-Notes-friendly Markdown view of diary.csv.
// One table per day (every place with all facility fields, next food/sauna, coords),
// preceded by a sections table + an at-a-glance day index. Regenerate whenever
// diary.csv changes: `npm run diary:md`. diary.csv stays the source of truth; this
// is a derived view, like the GPX/GeoJSON. source/url columns are intentionally omitted.

const CSV = process.argv[2] || DIARY;
const OUT = process.argv[3] || "diary.md";
const PLAN = OUT.includes("-B") ? "Plan B (Tjulträsk shortcut)" : OUT.includes("-A") ? "Plan A (via Aigert)" : "";
const isB = PLAN.includes("Plan B");
const UPDATED = new Date().toISOString().slice(0, 10);

const ICON: Record<string, string> = {
  hut: "🏠", camp: "🌙", boat: "⛵", shelter: "🛖", landmark: "📍",
  bus: "🚌", train: "🚆", flight: "✈️", hotel: "🏨",
};

// RFC-4180 CSV parse (delimiter-aware) — same helper as build-diary.ts
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

type Row = Record<string, any>;

// number: comma->dot, drop trailing zeros ("7,0"->"7", "15,10760"->"15.1076")
const d = (s?: string): string => {
  const t = (s ?? "").trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? String(parseFloat(t)) : t;
};
const nz = (s?: string): string => { const t = d(s); const f = parseFloat(t); return !isNaN(f) && f !== 0 ? t : ""; };
// strip stray emails/urls from free text (they break Apple Notes tables)
const clean = (s?: string): string =>
  (s ?? "").replace(/\S+@\S+/g, "").replace(/\bhttps?:\/\/\S+/g, "").replace(/\b[\w-]+\.(?:se|com|org)\b/g, "")
    .replace(/\s*·\s*·\s*/g, " · ").replace(/^[\s·]+|[\s·]+$/g, "");

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sd = (date: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${WD[dt.getUTCDay()]} ${MO[+m[2] - 1]} ${+m[3]}`;
};

// ---------- load ----------
const raw = fs.readFileSync(CSV, "utf8");
const DELIM = raw.split("\n")[0].includes(";") ? ";" : ",";
const all = parseCSV(raw, DELIM).filter((r) => r.type !== "divider") as Row[];

// merge shop/sauna/restaurant sub-rows into the hut at the same km
const huts: Record<string, Row> = {};
for (const r of all) if (r.type === "hut") huts[d(r.from_start)] = r;
for (const r of all) {
  const h = huts[d(r.from_start)];
  if (!h || h === r) continue;
  if (r.type === "shop") h._food = nz(r.to_next_food);
  else if (r.type === "sauna") { h._sauna = true; h._snext = nz(r.to_next_sauna); }
  else if (r.type === "restaurant") h._rest = clean(r.notes);
}

const PRIM = new Set(["hut", "camp", "boat", "shelter", "landmark", "bus", "train", "flight", "hotel"]);
const primaries = all.filter((r) => PRIM.has(r.type));

// group into days at each overnight == x
const days: Row[][] = [];
let cur: Row[] = [];
for (const r of primaries) { cur.push(r); if ((r.overnight || "").trim() === "x") { days.push(cur); cur = []; } }
const after = cur;

// ---------- cell builders ----------
const facil = (r: Row): string[] => {
  const out: string[] = [];
  for (const [c, lab] of [["recharge", "recharge"], ["wifi", "wifi"], ["laundry", "laundry"], ["card", "card"]] as const) {
    const v = (r[c] || "").trim();
    if (v === "yes") out.push(lab); else if (v === "book") out.push(`${lab} (book)`);
  }
  if (r._sauna) out.push("sauna");
  return out;
};
const shopcell = (r: Row): string => {
  const p: string[] = [];
  const ss = (r.shop_size || "").trim();
  if (ss === "village") p.push("village shop");
  else if (ss === "large" || ss === "small") p.push(`${ss} shop`);
  else if (ss === "none") p.push("no shop");
  const buy = clean(r.buy_here); if (buy) p.push(`buy ${buy}`);
  if (r._food) p.push(`→ next food +${r._food} km`);
  return p.join(" · ");
};
const facilcell = (r: Row): string => { const p = facil(r); if (r._snext) p.push(`→ next sauna +${r._snext} km`); return p.join(" · "); };
const notescell = (r: Row): string => {
  let n = clean(r.notes);
  if (r._rest) n = clean(`${n} · restaurant: ${r._rest}`);
  const lat = d(r.lat), lon = d(r.lon);
  if (lat && lon) n = (n ? n + " · " : "") + `${lat}, ${lon}`;
  return n;
};
const place = (r: Row): string => `${ICON[r.type] || ""} ${r.name}`.trim();

// ---------- emit ----------
const L: string[] = [];
L.push(`# 📅 Kungsleden — Daily Planner${PLAN ? " · " + PLAN : ""}`, "");
L.push(`*Updated ${UPDATED} · 18 days, Hemavan→Abisko ~460 km, Aug 2–19. Cap ≤26.5 km/day, ease-in. Finish Aug 19, buffer 20–21, flight KRN Fri Aug 21 21:05 (be in Abisko by ~midday Aug 21).*`, "");
L.push("*Boat details → boat-crossings · exits → bail-out · shopping → food-plan · full data → diary.csv (Numbers).*", "");

L.push("## Sections", "", "| Section | km | Terrain / crux |", "|---|---|---|");
for (const [s, k, t] of [
  ["A · Hemavan→Ammarnäs", "0–78", isB ? "open mountain; steep Viterskalet→Syter; Serve→Ammarnäs via the Tjulträsk boat; 7 bridges at Tärnasjö" : "open mountain; steep Viterskalet→Syter & Serve→Aigert; 7 bridges at Tärnasjö"],
  ["B · Ammarnäs→Kvikkjokk", "78–254", "**remote crux** — long stages, big elevation, sparse resupply, open-ground nav; exits go south"],
  ["C · Kvikkjokk→Saltoluokta", "254–324", "rough forest, Sarek edge, 3 crossings; water scarce on tops"],
  ["D · Saltoluokta→Singi", "324–388", "transfer day; Vakkotavare→Teusajaure climb"],
  ["E · Singi→Abisko", "388–460", "graded, popular; Tjäktja pass 1150 m is the crux"],
]) L.push(`| ${s} | ${k} | ${t} |`);
L.push("", isB ? "*Crux days for a buffer: D8 Pieljekaise · D9–10 open-nav · D12 Kvikkjokk→Pårte · D16 Tjäktja. (D4 = Tjulträsk boat, not the Aigert climb.)*" : "*Crux days for a buffer: D4 Serve→Aigert · D8 Pieljekaise · D9–10 open-nav · D12 Kvikkjokk→Pårte · D16 Tjäktja.*", "");

L.push("## At a glance", "", "| Day | Date | Camp km | Walk | Headline |", "|---|---|---|---|---|");
days.forEach((day, i) => {
  const e = day[day.length - 1], nh = nz(e.not_hiked);
  const wk = `${d(e.hiked)} km` + (nh ? ` +${nh}` : "");
  const head = e.name.startsWith("Camp") ? (clean(e.notes) || "—") : `**${e.name.toUpperCase()} — finish**`;
  L.push(`| **${i + 1}** | ${sd(e.date)} | ${d(e.from_start)} | ${wk} | ${head} |`);
});
L.push("");

days.forEach((day, i) => {
  const e = day[day.length - 1], nh = nz(e.not_hiked);
  const wk = `${d(e.hiked)} km` + (nh ? ` +${nh} boat/transfer` : "");
  const note = clean(e.notes);
  L.push(`## Day ${i + 1} · ${sd(e.date)} · camp km ${d(e.from_start)} · ${wk}`);
  if (note) L.push(`*${note}.*`);
  L.push("", "| km | Place | Shop / buy | Facilities | Notes |", "|---|---|---|---|---|");
  for (const r of day) {
    if (r.type === "boat") {
      const cx = nz(r.crossed_km);
      L.push(`| ${d(r.from_start)} | ${place(r)} | ${cx ? "crosses " + cx + " km" : ""} | | see boat-crossings · ${d(r.lat)}, ${d(r.lon)} |`);
    } else {
      L.push(`| ${d(r.from_start)} | ${place(r)} | ${shopcell(r)} | ${facilcell(r)} | ${notescell(r)} |`);
    }
  }
  L.push("");
});

if (after.length) {
  L.push("## After the finish", "", "| km | Step | Notes |", "|---|---|---|");
  for (const r of after) L.push(`| ${d(r.from_start)} | ${place(r)} | ${clean(r.notes)} |`);
  L.push("");
}

fs.writeFileSync(OUT, L.join("\n") + "\n");
console.log(`diary.md: ${days.length} days + ${after.length} after-rows · from ${CSV}`);
