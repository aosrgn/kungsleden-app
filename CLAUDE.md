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
- **ON-TIME** — vs Plan A as concrete hours/days (camps anchored at 18:00; plan position
  ramps only during the walking window, so being on-plan reads ~0 at any hour) · buffer
  days left · single projected Abisko finish (on/after Aug 21 flagged "risks flight").
- **DAY LOG** — a "Mark day start" button logs the trail km each morning; shows each
  day's distance (next mark − this mark; the last runs to your current position). Also
  **feeds the measured average km/day** below, so marking is load-bearing for projections.

### Speed model (`useSpeed.ts` + `SpeedControl.vue`)
Unified: **start hour + end hour** (daily walking window) and a **seed km/day** (~25,
Plan A's rate). `avgKmDay` is measured from the day-log — the seed as one "day −1" prior
plus every completed day, so real days progressively outweigh it. `madeGoodKmh =
avgKmDay ÷ (end − start)` (breaks included) drives POI times and ETAs; `avgKmDay` drives
the finish/buffer. There is **no km/h "pace" input** — it was replaced by this. All three
inputs persist to localStorage. Off-trail fixes (offset > 2 km) don't drive the planner
or the day log.

### Explicitly cut (no v2 — the app is disposable after the trek)
Map/tiles, full DP planner, day-card scoring, drag-to-reshuffle, diff display, food
tracking, elevation chart, mobile-coverage warnings, water-proximity, cloud LLM,
runtime file upload / IndexedDB / persistence / verification badge. Data is baked in.

## Data — baked in, single authoritative copy
`public/data/diary.csv` (plan + POIs + gates; `;`-delimited, comma decimals) and
`public/data/kungsleden.geojson` (trail LineString + POI points) ship with the app and
are precached for offline use. `src/data/trip.ts` loads + parses them (`loadTrip()`).

These two files are the **single authoritative copies**. The diary/GPX generators are
vendored in **`tools/`** and wired to npm scripts (run from the repo root, any Node):
`npm run diary` (reproject coords→km, rewrite `diary.csv`), `npm run diary:md[:b]`
(regenerate the readable `tools/diary-A.md`/`diary-B.md`), `npm run gpx` (rebuild the field
map `tools/kungsleden.gpx` for Garmin/Footpath/Guru — re-import manually). `tools/` is
excluded from the app typecheck (`include` is `src/**`). Run `npm run diary` after any
coord/km edit so the km stay consistent with the trail line.

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
speed model (start/end window + measured avg km/day, no km/h pace); DAY LOG (daily
distances, feeds avgKmDay). All the planned functionality is in place.

## Style
Senior TS/Vue/Node dev. Terse. No trailing summaries. Lists over prose. Verify claims
empirically (don't dismiss firsthand observations). Ask before big direction changes.
NEVER commit without explicit approval. Follow the golden rule (YAGNI → KISS → SRP/SoC →
POLA → DRY → Perf).
