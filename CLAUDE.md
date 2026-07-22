# Kungsleden Planning PWA

Personal-use PWA for daily replanning during a solo Kungsleden thru-hike, **Aug 2–22 2026** (Hemavan → Abisko, ~460 km, 17 walking days + 3 buffer, no Kebnekaise, Saltoluokta→Vakkotavare transfer on Day 13, shortcut boats Tjulträsk/Bäverholmen/Alesjaure planned).

Live at [inthetech.dev](https://inthetech.dev). Deploys to GitHub Pages on push to `main`.

## Core design inversion
The plan is a **derived view**, not the source of truth. Position + expected pace + static trip data → all live-computed stats. There is no persisted "plan" to keep in sync.

## Sibling projects (all under `~/Development/kungsleden/`)
- **`../data/`** (was `~/Development/kungsleden-map`) — data authority. Holds `diary.csv` (source-tagged, semicolon-delimited, authoritative POI + gate data), `kungsleden.geojson` (trail + POIs from Naturkartan), `Footpath Export.gpx`, plus markdown docs (trip plan, huts-facilities, transport, booking-checklist). **Regenerates the GPX consumed by both this PWA AND an external nav app** — keep the GPX standards-compliant.
- **`../power/`** (was `~/Development/kungsleden-power`) — battery + solar simulation for the trek. Independent Node CLI. Not touched by this PWA.

## Data flow (single path, no fanciness)
- Trip data files (`diary.csv`, `kungsleden.geojson`) ship with the app AND can be reuploaded from iOS Files picker at runtime.
- All three durable assets (PMTiles map tiles, diary, geojson) are stored as Blobs in **IndexedDB** — one storage path, no fallback layers.
- `navigator.storage.persist()` requested on first save.
- Startup badge shows verified/missing state so the user has certainty before departure.

## Stack
Vue 3 + TS + Vite + `vite-plugin-pwa` + MapLibre GL. `idb-keyval` for IDB access. `pmtiles` for offline tiles. No backend.

## V1 scope (what ships)
- Trail line + POI markers on the map
- Current position projected onto the trail (cumulative km)
- Self-hosted PMTiles corridor (zoom 8–13, ~100 MB) via `pmtiles://` protocol. Hosted as a **GitHub Release asset** (2 GB cap), curled into `dist/` by `deploy.yml` at build time → served same-origin. Never committed to git (100 MB push limit + history bloat); local dev uses a gitignored copy in `public/`
- IDB Blob storage + persist + verification badge + Settings file-picker for diary/geojson replace (uploads validated by exact header-row match, no schema-version cell)
- Stats panel driven by position:
  - **Now**: km, section, elevation, daylight left
  - **Today**: diary-planned stop + ETA · huts reachable in end-of-day window · stop-time table (16:00→22:00 hourly) · next gate today with ETA
  - **On-time**: projected Abisko finish under 4 pace scenarios (expected, today >2h, yesterday, trip avg) · elevation-adjusted on-track ratio
- Pace input: Slow (3.0) · Normal (3.5) · Fast (4.0) · custom

## Explicitly cut from v1
Full DP planner, day-card top-K scoring, drag-to-reshuffle, diff display, food tracking, elevation profile chart, mobile-coverage warnings, landmark countdowns, water-source proximity, cloud LLM. Deferred to post-trek v2.

## Basemap decision (basemap saga: over)
Dropped Lantmäteriet WMTS + Basic Auth + Waymarked Trails overlay. Going self-hosted PMTiles corridor. Kills third-party runtime dependency and auth-in-SW complexity. See `docs/handoffs/2026-07-16-thread-consolidation.md`.

## Known iOS issue (kept working strategy)
iOS 18 standalone PWA geolocation is broken (always `code=1` with no prompt). Confirmed iOS bug. `MapView.vue` has a 3-strategy fallback (`minimal` / `low-acc` / `delayed`) that works when the PWA is loaded from Safari tab or after user tap. Don't debug further — accept the workaround.

## Style
Senior TS/Vue/Node dev. Terse. No trailing summaries. Lists over prose. Verify claims empirically (don't dismiss firsthand observations). Ask before big direction changes. NEVER commit without explicit approval. Follow the golden rule (YAGNI → KISS → SRP/SoC → POLA → DRY → Perf).

## Build metadata
Every commit stamps `__COMMIT_SHA__` + `__BUILD_TIME__` into the build via Vite defines, rendered in the footer badge. Confirm freshness by comparing badge to latest commit SHA.

## Secrets (obsolete — being removed)
`VITE_LM_USER` / `VITE_LM_PASS` are still in GitHub Actions and referenced in `deploy.yml` for Lantmäteriet auth. **Slated for removal** in session 1 (part of the basemap-saga cleanup).
