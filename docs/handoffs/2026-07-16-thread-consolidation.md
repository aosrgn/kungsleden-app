# 2026-07-16 · Thread Consolidation & V1 Scope Lock

> **SUPERSEDED — historical only.** The map/tiles/PMTiles/IndexedDB direction below was
> dropped. Read `2026-08-01-app-built-handoff.md` for the real state.

Context: the user had two parallel Claude Code sessions running on this repo (one cloud, one local design/discussion). This handoff merges them, locks the v1 scope, and sets up the local workspace for the final week of pre-trek development.

## What was in the cloud session (before this handoff)

Working branch `claude/fix-constraint-solver-issue-fUJdC` (retired — merged to `main`). 14 commits between May 20 morning and evening. Achievements:

1. Loop v1 validated (static index.html deployed via Pages).
2. Vue 3 + Vite + PWA scaffold (`80da9cd`).
3. MapLibre-gl swapped in for Leaflet (`366ae56`).
4. iOS Safari geolocation debugging: 5 commits landed on a 3-strategy fallback (`minimal` / `low-acc` / `delayed`); confirmed **iOS 18 standalone PWA geolocation is fundamentally broken** (always `code=1 User denied`, no prompt). Kept `display: standalone` in manifest; PWA is launched from Safari as a workaround.
5. Custom apex domain: **inthetech.dev**, root path.
6. Lantmäteriet WMTS with Basic Auth via MapLibre `transformRequest` (`7a2927e`). Only the free "översiktlig" layer available (maxzoom 9); the detailed "Topografisk webbkarta Visning" costs €900/yr and was rejected.
7. Waymarked Trails hiking overlay + on/off toggle (`c861524`).

Awaiting decision at cloud-session close: "Is Waymarked Trails overlay + LM översiktlig good enough, or switch to MapTiler Outdoor?"

## Decision: end the basemap saga

**Neither.** We drop LM auth + Waymarked Trails + OpenTopoMap runtime dependency entirely and switch to **self-hosted PMTiles bundled with the app**.

Rationale:
- The Kungsleden PWA is a *planning aid*. The user carries a separate real navigation app for on-trail navigation. The basemap here is context wallpaper, not a nav-grade surface.
- The trail itself is drawn from `kungsleden.geojson` (our own overlay) — no need for a "hiking trails" tile layer.
- Third-party runtime tiles create offline-caching fragility. LM Basic Auth in a service worker is particularly hazardous.
- Kungsleden runs through certified dead-zone territory (Sarek NP, Saltoluokta→Kvikkjokk, Abisko NP interior). Offline must be **deterministic**, not "should probably work."

Approach: generate a PMTiles bundle from OpenTopoMap raster for the trail corridor, zoom 8–13, ~100 MB, ships in `public/` as a single file. MapLibre reads via `pmtiles://` protocol handler. One file, one path.

## Storage: single-path, no fallback layers

The user rejected multi-layer storage (Cache API + IDB + file-import backup) as complexity, not safety. Accepted architecture:

- **PMTiles blob + diary.csv + kungsleden.geojson** all stored in IndexedDB (via `idb-keyval`).
- `navigator.storage.persist()` requested at first save. Installed PWAs on iOS 17+ typically get it granted.
- Startup verification: hash-check the PMTiles blob, show 🟢/🔴 badge with byte size.
- Settings file-picker for reupload from iOS Files (iCloud Drive).
- Accepted residual risk: rare IDB purge mid-trek → map missing, but plan data (few KB of JSON) still baked into JS bundle → planning UI still works, degraded. Nav app covers actual navigation.

Pre-trek confidence ritual: install PWA on WiFi → download offline map → airplane mode → force-quit → reopen → confirm map loads at every zoom. If passes 24h airplane-mode test, ships.

## Trip parameters (superseded original brief — from `../data/diary.csv`)

Original brief said Aug 8–29 / 440 km. **Diary is authoritative**:
- **Start Aug 2, arrive Abisko Aug 19, train to Kiruna Aug 21, fly KRN 09:50 Aug 22.**
- **~460 km, 18 walking days + 2 buffer days.**
- Main line via Singi (**Kebnekaise NOT taken**).
- **Day 14 (Aug 15)** = non-hiked transfer Saltoluokta→Vakkotavare via M/S Langas boat + bus (~30 km). **2026 bus schedule is irregular due to Gällivare rail works — needs on-trek confirmation.**

## Hard-constraint gates (from diary + `transport.md`)

Kilometers from Hemavan start. Each = (km, time-window, booking mode, cost).

| Km | Gate | Times | Booking | Cash? |
|---|---|---|---|---|
| 189.4 | Vuonatjviken boat | on-demand, unpublished | pre-book by phone | — |
| 254.2 | Sakkat boat | 09:30 / 11:30 / 19:00 | book online | card |
| 293.5 | Laitaure boat | **09:00 & 17:00 only** ⚠️ | flag-signal, no booking | **cash 300kr** |
| 305.1 | Sitojaure boat | on-demand | **pre-book from Aktse** (no signal at pier) | **cash** |
| 324.4 | M/S Langas | ~10:00 base + high-season slots | online or onboard | card |
| 352.1 | Kebnats→Vakkotavare bus | 10:55 / 16:50 (2026 IRREGULAR) | booking partners | card |
| 366.8 | Teusajaure boat | 09:00 / 15:00 / 18:00 | flag-signal | **cash 150kr** |
| 425.3 | Alesjaure boat | 4 slots Jul 1–Aug 30 | book ahead, 500kr | card or cash |
| 460 | Abisko finish | Aug 19 evening (soft with 2 buffer days) | — | — |

Weather-cancelable: Laitaure, Teusajaure. Cash total to carry: ~700–800 kr minimum.

## V1 scope (locked)

**Map:** self-hosted PMTiles corridor + `kungsleden.geojson` trail overlay + POI markers from `diary.csv` + current position dot.

**Storage:** IDB Blob single path + persist + verification badge + file-picker reupload for diary/geojson.

**Stats panel** (position-driven, live):
- **Now**: km, section, elevation, daylight left
- **Today**:
  - Diary-planned stop + ETA at current expected pace
  - Huts reachable within end-of-day window (late afternoon → 22:00)
  - Stop-time table: hourly rows 16:00→22:00, each showing km reached + nearby POI
  - Next gate today with ETA if any
- **On-time (Abisko projection)**: four pace scenarios shown simultaneously — expected pace / today's pace (only after ≥2h walked) / yesterday's pace / trip average
- **Elevation-adjusted on-track ratio**: time-progress today vs. expected-time-progress for distance covered (uses fixed `segment_time` from GPX elevation, not a learning model)

**Pace input:** one number, Slow (3.0) · Normal (3.5) · Fast (4.0) · custom.

## Cut from v1

Full DP planner, day-card top-K scoring, drag-to-reshuffle, diff display, food tracking, elevation profile chart, mobile-coverage warnings, landmark countdowns, water-source proximity, cloud LLM. Deferred to post-trek v2.

## Week-of plan (6 focused sessions)

Deadline: pre-departure verification pass on hardware.

| # | Session | Deliverable |
|---|---|---|
| 1 | **Port + clean** | Local checkout ✓ · main promotion ✓ · CLAUDE.md ✓ · this handoff ✓. Drop LM + Waymarked Trails + LM secrets from workflow. Load `kungsleden.geojson` overlay, trail visible on map. |
| 2 | **Diary → POIs** | In-browser CSV parse of `diary.csv`, POI markers with category icons, tap for details, file-picker reupload in Settings. |
| 3 | **PMTiles + IDB storage** | Generate corridor PMTiles bundle, wire `pmtiles://` MapLibre source, IDB storage, persist request, verification badge. |
| 4 | **Position + pace + stop-time table** | Project GPS onto trail, pace input, "Now" + "Today" panel sections live. |
| 5 | **Gates + on-time projection** | Parse gate time-windows from diary notes, next-gate ETA, four-scenario projection, elevation-adjusted ratio. |
| 6 | **Pre-trek verification ritual** | Airplane-mode dry run on device, fix whatever surfaces, ship. |

Sessions 1–3 give a working "map + POIs + guaranteed offline." Sessions 4–5 add the brains. Session 6 is the confidence test.

If session 5 slips, 1–4 still ship as a usable planning aid.

## Style notes (repeated in CLAUDE.md but worth having together)

Senior TS/Vue/Node dev. Terse. Lists over prose. Verify claims empirically. Ask before big direction changes. NEVER commit without approval. Golden rule: YAGNI → KISS → SRP/SoC → POLA → DRY → Perf.
