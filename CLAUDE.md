# Kungsleden Planning PWA

Personal-use PWA for daily replanning during a solo Kungsleden thru-hike:
**18 walking days, Hemavan → Abisko (~460 km), Aug 2–19 2026**, ease-in start,
≤26.5 km/day cap, no Kebnekaise. Finish Abisko Aug 19, buffer Aug 20–21, flight
KRN → ARN **Fri Aug 21 21:05** (be in Abisko by ~midday Aug 21). **Plan A** (mainline
via Aigert) is the reference route; **Plan B** (Tjulträsk shortcut) is an alternative
kept only in the field GPX — the app plans against Plan A.

Live at [inthetech.dev](https://inthetech.dev). Deploys to GitHub Pages on push to `main`.

## Core design inversion
The plan is a **derived view**, not the source of truth. Position + expected pace +
static trip data → all live-computed stats. There is no persisted "plan" to keep in sync.

## Scope — lean planner (no map)
No tiles, no basemap, no MapLibre. The screen is a scrollable **route strip** (a vertical
line of the diary POIs by km, position anchored) plus stat panels. Everything is driven by
the device position projected onto the trail line.

- **Route strip** — every located diary feature as a node (icon · name · km), overnight
  stops emphasised, anchored to your position. Each POI shows its **planned per-day
  crossing clock-time** (`D{n} HH:MM`, from that day's camp + start hour + made-good speed;
  a late camp arrival is flagged "long day") plus a live `eta HH:MM` from your position.
- **NOW** — km along route · section · daylight left. (No elevation: the trail geojson
  is 2-D and the diary has none, so elevation is dropped everywhere.)
- **TODAY** — planned stop + ETA · huts passed before the planned stop · next hut if
  reachable ~2 h past the stop.
- **ON-TIME** — vs Plan A as concrete hours/days (camps anchored at the end hour; plan
  position ramps only during the walking window, so being on-plan reads ~0 at any hour) ·
  buffer days left · single projected Abisko finish (flagged "risks flight" when the
  buffer drops under half a day, so flag and number can never disagree).
- **DAY LOG** — camp marks: per-day distances + km done so far today. History only.

### The finish projection is plan-relative (`plan.ts` + `OnTimePanel.vue`)
Only two inputs: **current position** and **current date**, matched against Plan A.
`ratio = your km ÷ plannedKmAtTime(now)`, then the finish is plain distance ÷ rate:
`finish = now + planTimeLeft × (yourKmLeft ÷ planKmLeft) ÷ ratio`, borrowing the plan's own
remaining rate so its day-by-day shape is kept (the long middle days cost more than the
ease-in ones). Because both sides of the ratio span the same days, **Plan A's ease-in
cancels out** — the plan does 7/18/21 km on days 1–3 and ~27 thereafter, so anything that
extrapolates a measured km/day reads those short days as "slow" and predicts a missed
flight while you are in fact ahead. That was the old day-log model's fatal flaw. The ratio
is clamped to 0.4–2.5, and it is unreliable for the first 2–3 days (small denominator) —
it settles from roughly day 4.

**Measure the remaining span from `now`, never from the plan-time of your km.** That
earlier moment usually falls on a previous day, so the span back to the finish re-counts a
night already slept — worth ~15 h of invented lateness every morning. The invariant to
protect: parked at a planned camp exactly on plan, the projected finish must equal the plan
finish at *any* hour, including across the overnight (68-case check in the scratchpad).

The **day log feeds none of this** — see below. Nothing you forget to tap can make the
projection wrong.

### Day log (`useDayLog.ts` + `DayLogPanel.vue`) — a journal, not an input
"Mark camp" stores `{km, at}` in localStorage at each overnight stop.

**A camp belongs to a night, and night *n* is the one that ended trek day *n*.**
`campsByNight` (in `plan.ts`) resolves marks to nights off the **hour** of the tap, not the
date: before 12:00 you're standing in the camp you just slept in, so it closed *yesterday*;
from midday on you've just pitched, so it closes *today*. Mark on arrival in the evening or
over breakfast next morning — same night either way. One camp per night, **latest mark
wins**, so re-marking corrects instead of duplicating (and supersedes the retired
auto-inserted km-0 trailhead row, which older phones still have in storage).

Rows are dated day *n* and carry that day's distance (this camp − the previous, or km 0 for
day 1), so the log starts at D1 with no phantom mark. The open day runs from the last camp
to your live position — the running "how far today" read — and is hidden until that day has
begun, so an evening mark doesn't sprout a 0.0 km row for tomorrow. A forgotten camp leaves
a gap in the numbering instead of renumbering everything after it. Each row's **camp km is
editable** (and removable) — you'll tap "Mark camp" an hour up the trail sooner or later.
Marks come from the real on-trail position, never the simulated km.

It used to drive `avgKmDay` → the finish projection; that coupling is what made a missed
morning tap look like a scheduling problem. **Don't reconnect it to the projection.**

### Real camps anchor the day (`realisedStops` in `plan.ts`)
Fed the night camps above, `realisedStops` rewrites each planned day-end camp to where you
actually slept, wherever one exists.
That feeds `poiArrival`, so the day's crossing times run from the real camp: camping 1.5 km
past the planned spot pulls the whole day's clock ~33 min earlier. Days not yet slept keep
their planned camp; the sequence is forced non-decreasing so an overshoot can't run a day
backwards; with no marks it returns the plan untouched. **`plannedKmAtTime` deliberately
does NOT use this** — "vs Plan A" has to compare against Plan A.

The route strip renders each night camp as a squared-off ⛺ pin with the same signed
km-from-you label as every other node, named for the night it closed — `⛺ Camp D1 ·
Aug 2→3` lands beside the diary's `🌙 Camp Day 1` for that same night, planned against
actual. Each carries the distance walked to reach it. Pin and day-log row now agree on the
number, both keying off the night.

### Speed model (`useSpeed.ts` + `SpeedControl.vue`)
**Start hour + end hour** (the daily walking window) and **km/day** (~25, Plan A's rate).
`madeGoodKmh = kmDay ÷ (end − start)` (breaks included) drives POI crossing times and
ETAs **only** — never the finish projection, so a stale pace guess can't distort it. The
window is also what the Plan A ramp uses: a hardcoded 08:00 while you actually leave at
09:00 invents an hour of deficit every morning. All three inputs persist to localStorage.
Off-trail fixes (offset > 2 km) don't drive the planner.

### Explicitly cut (no v2 — the app is disposable after the trek)
Map/tiles, full DP planner, day-card scoring, drag-to-reshuffle, diff display, food
tracking, elevation chart, mobile-coverage warnings, water-proximity, cloud LLM,
runtime file upload / IndexedDB / persistence / verification badge. Data is baked in.

## Data — baked in, single authoritative copy
`public/data/diary.csv` (plan + POIs + gates; `;`-delimited, comma decimals),
`public/data/kungsleden.geojson` (trail LineString + POI points) and
`public/data/kungsleden.gpx` (the generated field map) ship with the app and are precached
for offline use. `src/data/trip.ts` loads + parses the first two (`loadTrip()`).

These three files are the **single authoritative copies**. The diary/GPX generators are
vendored in **`tools/`** and wired to npm scripts (run from the repo root, any Node):
`npm run diary` (reproject coords→km, rewrite `diary.csv`), `npm run diary:md[:b]`
(regenerate the readable `tools/diary-A.md`/`diary-B.md`), `npm run gpx` (rebuild
`public/data/kungsleden.gpx`). `tools/` is excluded from the app typecheck (`include` is
`src/**`). Run `npm run diary` after any coord/km edit so the km stay consistent with the
trail line. All generators are idempotent — a rerun with no input change is a no-op.

**Post-trek: daily tracks for Apple Health** (`dailyTracks.ts` + the second `GpxExport`
button). The field GPX is a planned route with waypoints and no times, so nothing can turn
it into a workout. `dailyTracks()` instead rebuilds one timestamped GPX **track** per
walking day from `trail.slice(fromKm, toKm)` + the day log's night camps, at constant pace
across the walking window. Share-sheets all of them at once; import via RunGap → Health to
get the trek as hikes with a route. The closing day (ends at Abisko, so no camp mark) uses
`finishKm` from your position — set "simulate km" to 460 once home to include it.
Timestamps are **reconstructed, not recorded**; fine as a personal record, not a GPS trace.

**Getting the GPX onto the phone:** `GpxExport.vue` fetches the precached GPX and hands it
to `navigator.share({files})` → the iOS share sheet → Garmin/Footpath/Guru, falling back to
an `<a download>` where Web Share can't take files. Fetching the raw file directly doesn't
work: iOS serves `.gpx` as `text/plain` and renders it inline instead of downloading.

## Sibling projects (all under `~/Development/kungsleden/`)
- **`../data/`** — NOT in this repo, local-only, NOT a git repo. Holds only `export.ts`
  (the Naturkartan guide-97 API pull that regenerates `kungsleden.geojson` +
  `kungsleden-base.gpx`; network + embedded key, rarely re-run) and the logistics markdown
  (boat-crossings, food-plan, water-zones, bail-out). Uses **devbox** for Node (`devbox
  run -- npm run export`, never `devbox run -- tsx …`).
- **`../power/`** — battery + solar simulation. Independent, not touched by this PWA.

## Stack
Vue 3 + TS + Vite + `vite-plugin-pwa`. No backend, no map library. Geolocation lives in
`src/composables/useGeolocation.ts`.

## Offline + updates
- `vite-plugin-pwa` `generateSW`; `registerType: 'prompt'` — a new build downloads but
  stays **waiting** until the user taps **Update** (`UpdatePrompt.vue` / `useRegisterSW`).
  Nothing swaps underfoot in the field.
- `workbox.globPatterns` precaches the bundled `csv`/`geojson` alongside the app shell.
- Field workflow: drive changes from the phone via Claude Code in the cloud → commit →
  push → GitHub Pages deploys → reload the app → tap Update.

## Known iOS geolocation gotcha
iOS-18 standalone PWAs have a history of returning `code=1` (denied, no prompt), and
`useGeolocation.ts` keeps a 3-strategy fallback (`minimal` / `low-acc` / `delayed`) for it.
BUT a denial hit in testing turned out to be a **device Location Services setting**, not
the code — so if location fails in the field, check **Settings → Privacy & Security →
Location Services** (on; Safari Websites = Ask/While Using) and Safari's per-site Location
permission FIRST, before touching the app. Geolocation is only triggered by a user tap
("Locate me"), per the iOS gesture requirement.

## Build metadata
Every build stamps `__COMMIT_SHA__` + `__BUILD_TIME__` via Vite defines, rendered in the
footer badge (`deploy.yml` sets `VITE_COMMIT_SHA`/`VITE_BUILD_TIME`). Confirm freshness by
comparing the badge to the latest commit SHA.

## Status
Built: geolocation composable, map removed, data bundled + loaded, manual Update button
+ precache; position → km projection (`src/trail.ts`); position-anchored route strip with
per-day planned crossing times + live ETAs; panels NOW (km · section · daylight), TODAY
(stop ETA · huts), ON-TIME (vs Plan A · buffer · single projected finish); the unified
speed model (start/end window + km/day, no km/h pace). Day 4 of the trek: the day log was
deleted and the finish projection rebuilt plan-relative, because extrapolating a measured
km/day across Plan A's ease-in predicted a missed flight while running ahead of schedule.
All the planned functionality is in place.

## Style
Senior TS/Vue/Node dev. Terse. No trailing summaries. Lists over prose. Verify claims
empirically (don't dismiss firsthand observations). Ask before big direction changes.
NEVER commit without explicit approval. Follow the golden rule (YAGNI → KISS → SRP/SoC →
POLA → DRY → Perf).
