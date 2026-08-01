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
  stops emphasised. Position anchoring + per-node ETA layer on top.
- **NOW** — km along route · section · daylight left. (No elevation: the trail geojson
  is 2-D and the diary has none, so elevation is dropped everywhere.)
- **TODAY** — planned stop + ETA · huts passed before the planned stop · next hut if
  reachable ~2 h past the stop at pace.
- **ON-TIME** — vs Plan A as concrete hours/days (camps anchored at an 18:00 arrival, so
  being on-plan reads ~0) · buffer days left before the flight · projected Abisko finish
  per pace (finishes on/after Aug 21 flagged "risks flight").
- **DAY LOG** — a "Mark day start" button logs the trail km each morning; shows each
  day's distance (next mark − this mark; the last runs to your current position).

Pace input: Slow (3.0) · Normal (3.5) · Fast (4.0) · custom km/h, plus walking hours/day
(drives the finish projection). Both persisted to localStorage.

### Explicitly cut (no v2 — the app is disposable after the trek)
Map/tiles, full DP planner, day-card scoring, drag-to-reshuffle, diff display, food
tracking, elevation chart, mobile-coverage warnings, water-proximity, cloud LLM,
runtime file upload / IndexedDB / persistence / verification badge. Data is baked in.

## Data — baked in, single authoritative copy
`public/data/diary.csv` (plan + POIs + gates; `;`-delimited, comma decimals) and
`public/data/kungsleden.geojson` (trail LineString + POI points) ship with the app and
are precached for offline use. `src/data/trip.ts` loads + parses them (`loadTrip()`).

These two files are the **single authoritative copies**. The sibling `../data/` toolset
(see below) regenerates them **in place** at `../app/public/data/` — its scripts point
there via `data/src/paths.ts`. There is no second copy to keep in sync.

## Sibling projects (all under `~/Development/kungsleden/`)
- **`../data/`** — data authority + generators (NOT a git repo; uses **devbox** for node —
  run scripts as `devbox run -- npm run <x>`, never `devbox run -- tsx …`). Holds
  `diary-B.csv` (Plan B), the field GPX (`kungsleden.gpx`, emoji labels — consumed by
  Garmin/Footpath/Guru), `kungsleden-base.gpx`, markdown docs, and the scripts that
  regenerate this app's `diary.csv` + `kungsleden.geojson`.
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
ETAs; panels NOW (km · section · daylight), TODAY (stop ETA · huts), ON-TIME (vs Plan A ·
buffer · finish-per-pace); pace + hours/day selector; DAY LOG (daily distances). All the
planned functionality is in place.

## Style
Senior TS/Vue/Node dev. Terse. No trailing summaries. Lists over prose. Verify claims
empirically (don't dismiss firsthand observations). Ask before big direction changes.
NEVER commit without explicit approval. Follow the golden rule (YAGNI → KISS → SRP/SoC →
POLA → DRY → Perf).
