# Handover — Kungsleden planner (app built) · 2026-08-01

You are resuming a personal project: an offline **Kungsleden thru-hike planner PWA** and
the trip data behind it. This doc lets you pick up **anything** from the prior thread —
app code *or* the diary/data. Read this first, then `CLAUDE.md` (repo root) for the
condensed rules. For deep trip logistics/research (boats, water, food, transport,
Garmin/Guru research, decisions), also read the earlier handoff
`docs/handoffs/2026-07-31-field-and-app-context.md` — still valid except where this doc
supersedes it (the app is now BUILT, and the speed model changed — see below).

The trek: solo, **Hemavan → Abisko, ~460 km, Aug 2–19 2026** (18 walking days), buffer
Aug 20–21, flight **KRN→ARN Fri Aug 21 21:05** (be in Abisko by ~midday Aug 21). **Plan A**
(mainline via Aigert) is the reference route; **Plan B** (Tjulträsk shortcut) is an
alternative kept only in the field GPX.

---

## 1. Working rules (STRICT — the user runs it this way)
- **Never commit without explicit approval. Never push** — the user pushes themselves
  (`! git push` from the prompt, or does it manually). Present the exact `git add …` +
  one-line commit for approval, then commit.
- Commit format: single-line `type: description`, **no body, no Co-Authored-By, no
  scope-in-parens**. Atomic — one logical change per commit.
- **Per-commit review loop** (the user's methodology): implement one commit → spin up a
  review **subagent (model `sonnet`)** to check it (correctness, regressions, edge cases)
  → apply fixes → re-review substantive fixes → present for approval → commit. Keep each
  change buildable. This is how the whole app was built; keep doing it.
- **Minimal changes only.** Don't "improve" unrelated code. **Surface forced choices**
  (defaults/ordering/modeling with real tradeoffs) instead of silently picking — ask with
  a recommended default. The user is decisive and iterates on modeling; expect it.
- **Provenance / no guessing**: never state logistics (shop hours, cell coverage,
  deadlines, prices) as fact — source it (WebSearch/WebFetch) or label it unknown. The
  user fact-checks.
- Golden rule: YAGNI → KISS → SRP/SoC → POLA → DRY → Performance.

## 2. Repos, environment, deploy
- **This repo** = the app: `aosrgn/kungsleden-app`, deploys to **inthetech.dev** via
  GitHub Pages (`.github/workflows/deploy.yml`) **on push to `main`**. Current tip when
  this was written: `123b21a`, tree clean.
- **Build**: `npm ci && npm run build` (Node ≥ 20; `vue-tsc` typecheck + vite). *Local
  note:* on the author's machine Node came from a sibling **devbox** at
  `../data/.devbox/nix/profile/default/bin` — a cloud env has its own Node, just use it.
- **Deploy flow**: push `main` → Actions builds → Pages serves → reload the app → tap
  **Update** (the SW holds new builds until you tap). Build badge (bottom-right) shows the
  commit SHA — confirm it matches after deploy. Manifest `display: standalone`; **only if
  you change `display`** must the user delete + re-add the home-screen icon (iOS caches
  the manifest).
- **The diary/GPX generators are vendored into `tools/`** (runnable via `npm run` — see
  §5), so a fresh clone can regenerate everything. The sibling `../data/` folder is now
  only the Naturkartan API-pull (`export.ts`) + logistics markdown, and stays local-only.

## 3. The app — architecture (all built, reviewed, deployed)
Vue 3 + TS + Vite + `vite-plugin-pwa`. No map/tiles, no backend. Entry `src/main.ts` →
`App.vue` (renders `PlannerView` + `UpdatePrompt` + build badge).

**`components/PlannerView.vue`** is the orchestrator: owns geolocation, the shared clock,
speed inputs, trip load, and the derived `positionKm`/`madeGoodKmh`; feeds every panel.

Composables (`src/composables/`):
- `useGeolocation.ts` — device position + the **iOS-18 3-strategy fallback**
  (`minimal`/`low-acc`/`delayed`); triggered by a user tap ("Locate me"). Note: a denial
  in testing traced to a **device Location Services setting**, not the code — check iOS
  Settings first if location fails.
- `useNow.ts` — one shared minute clock (drives daylight, ETAs live).
- `useSpeed.ts` — the speed inputs (see §4).
- `useDayLog.ts` — persisted camp marks (`{km, at}`). **Journal only — feeds no
  projection** (§4). Seeds the trek's days 1–4 if the stored log is empty.

Logic modules:
- `src/data/trip.ts` — `loadTrip()` fetches + parses `public/data/diary.csv` (`;`-delim,
  comma decimals) + `kungsleden.geojson` (trail LineString + POI points).
- `src/trail.ts` — `createTrailIndex()` → `project(lat,lng) → {km, offsetKm}` (cumulative
  haversine along the ~8.4k-pt line; a port of the diary builder so app-km == diary-km).
- `src/daylight.ts` — sunrise/sunset (SunCalc-style, no deps); handles polar + pre-dawn.
- `src/plan.ts` — Plan A schedule from the diary: `planStops`, `huts`, `stopForDay`,
  `trekPhase`, `poiArrival` (planned per-day POI clock time), `startOfDay`/`addDays`, and
  the plan curve — `plannedKmAtTime` (where the plan expects you *now*), its inverse
  `plannedTimeAtKm` (when the plan expects you at a km) and `planFinish`. All three take
  **your** `startHour`/`endHour`; the ramp climbs only inside that window and sits flat at
  camp overnight, so on-plan reads ~0 at any hour.

Panels: **NOW** (km · section A–E · daylight) · **TODAY** (planned stop + ETA · huts
passed · next hut if reachable ~2h past) · **ON-TIME** (vs Plan A in hours/days · buffer
days · projected Abisko finish, flagged "risks flight" under half a day of buffer) · **DAY
LOG** (camp marks → per-day distances + km so far today; journal only). Route strip shows
every POI with its **planned per-day crossing time** (`D{n} HH:MM`, "long day" flag on late
camp arrivals) plus a live `eta HH:MM`. Off-trail fixes (offset > 2 km) pause the planner
and disable "Mark camp" so the log can't take a simulated km.

## 4. The finish projection + speed model (rebuilt on trek day 4)
**The projection needs only position + date.** `ratio = positionKm ÷ plannedKmAtTime(now)`;
`finish = now + (planFinish − plannedTimeAtKm(positionKm)) ÷ ratio`; `buffer = deadline −
finish`. Ease-in cancels because both sides of the ratio span the same days. Ratio clamped
0.4–2.5; noisy for the first 2–3 days (small denominator), settles from ~day 4.

**Why the old model was replaced** (it was live for the first three trek days): it did
`remaining ÷ avgKmDay`, where `avgKmDay` came from morning "mark day start" taps. Plan A
ramps — 7/18/21 km on days 1–3, ~27 km/day after — so the measured average was ~21 km/day
during the ease-in and got extrapolated across the steep remainder. On Aug 5 at km 47.5
(1.5 km **ahead** of plan) it read *finish Aug 24, buffer −2.5 days, risks flight*. Walking
Plan A perfectly produced the same verdict — the panel could not read anything else during
week one. Verified: plan-exact days gave buffers of −9.5 → +2.5 over the trip; the ratio
model holds ~1.0 throughout.

**The day log stays, decoupled.** It was briefly deleted with the old model and restored
the same day: the user reads "km done so far today" off it constantly and wants the camp
history. It is now a pure journal — no projection reads it, so a missed tap costs history
and nothing else. Rows number by calendar date vs the diary's day 1 (a forgotten camp
leaves a gap, rather than renumbering the rest). localStorage key `kungsleden.daylog`
survived the deletion untouched — only the code had gone — and `useDayLog.ts` carries a
seed of the trek's first four marks (km 0 · 8.4 · 25.1 · 47.5) used **only** on an empty
log, reconstructed from the on-screen running totals.

Speed inputs (`SpeedControl.vue`, persisted; `seedKmDay` is migration-read as `kmDay`):
**start hour** (8), **end hour** (18), **km/day** (25 = Plan A's rate).
- `madeGoodKmh = kmDay ÷ (end − start)` (breaks included) → drives POI times + ETAs
  **only**; the projection never touches it.
- **vs Plan A** = (your km − plan's km now) ÷ madeGoodKmh, as concrete hours. `plan.ts`
  used to hardcode an 08:00 ramp start regardless of the window, which invented ~1.2 h of
  phantom deficit each morning for a 09:00 start; it now uses the real window.
- POI planned time = `startHour + (poiKm − dayStartCampKm) / madeGoodKmh`, per segment
  camp[i]→camp[i+1] (day 1 from km 0). Caveat: applies walking speed to the whole segment,
  so the boat/bus transfer day (Day 14) reads late ("past 24:00") — a known limitation.

## 5. The diary / data — how to work on it (READ THIS for diary work)
`public/data/diary.csv` is the **single authoritative** trip file (24-col `;`-CSV, comma
decimals, source-tagged). It is committed in this repo, so editing it and pushing updates
the app live (route strip, panels, POI times all read it). `kungsleden.geojson` (trail
LineString + POI points) sits beside it.

**The generators are vendored in `tools/`** and wired to npm scripts (run from the repo
root, any Node — no devbox needed):
- `npm run diary` — `build-diary.ts`: reprojects every located row's `lat/lon` → `from_start`
  km against the geojson trail and recomputes distances; rewrites `public/data/diary.csv`
  (idempotent). **Run this after any coord/km edit** so the km stay consistent.
- `npm run diary:md` / `npm run diary:md:b` — `build-diary-md.ts`: regenerates the readable
  `tools/diary-A.md` / `tools/diary-B.md` day-by-day views.
- `npm run gpx` — `build-gpx.ts`: rebuilds the field map `public/data/kungsleden.gpx` (emoji
  labels, A/B camps + boat/shop/bus pins) from `diary.csv` + `tools/diary-B.csv` +
  `tools/kungsleden-base.gpx`. You still **manually re-import that GPX into Garmin/
  Footpath/Guru** on the phone — via the app's **Export field GPX** button (share sheet;
  `GpxExport.vue`), since iOS renders a fetched `.gpx` inline instead of downloading it.
- `tools/paths.ts` holds the paths; `tools/poi-labels.ts` the emoji/shorten rules.

So from a clone you can do BOTH: hand-edit `diary.csv` (safe for `notes` / text — the app
reads them verbatim; example this session: the Day-3/4 Serve/Aigert notes), AND
regenerate km/GPX/markdown via the npm scripts. `tools/` is excluded from the app
typecheck (tsconfig `include` is `src/**`), so it never affects the build.

CSV format notes: `overnight = x` marks sleeps; camps are `type=camp` (no lat/lon → coords
derived from km); rows with `from_start > ~460` are the post-hike transport tail
(train/flight/hotel), intentionally rendered on the strip but excluded from schedule math.

**Still local-only in `../data/`** (NOT vendored): `export.ts` — the Naturkartan guide-97
API pull that regenerates `kungsleden.geojson` + `kungsleden-base.gpx` (needs network + an
embedded key, essentially never re-run) — plus the logistics markdown
(`boat-crossings-A/B.md`, `food-plan.md`, `water-zones.md`, `bail-out.md`). Boat coords
are placed on the boarding banks; details in the 2026-07-31 handoff.

## 6. Key decisions & reversals (don't re-litigate)
- Map/tiles cut → lean planner; data baked in (no IndexedDB/upload/verification badge).
- Elevation dropped everywhere (trail is 2-D, diary has none).
- Manual **Update** button (`registerType: 'prompt'`); precache includes the data files.
- `display: standalone` (a `browser`-mode experiment was reverted; geolocation issue was a
  device setting, not display mode).
- ON-TIME "vs Plan A": iterated from ½-day (artifact) → 18:00-anchored → **walking-window
  `plannedKmAtTime`** so on-plan reads ~0 all day.
- Speed model: pace-km/h + hours/day → start/end window + measured avg km/day (seed 25) →
  **start/end window + a plain km/day, ETAs only**. Multi-pace finish table → single
  projected finish.
- Finish/buffer: measured-average extrapolation → **plan-relative ratio** (§4). Don't
  reintroduce a km/day-driven projection — Plan A's ease-in guarantees it reads "risks
  flight" for the first week no matter how fast you walk.
- Day log: kept as a **journal**, decoupled from the projection. Deleting it outright was
  a step too far — it's the user's live "km done today". Don't wire it back into any math.
- Diary Serve/Aigert day-notes fixed (Serve is passed Day 4, not Day 3).

## 7. Open / time-sensitive
- **Pre-book boats** (Bäverholmen, Vuonatjviken [fragile], Alesjaure, Sakkat; Plan-B
  Tjulträsk; airport Boreal bus). Cash ~2,000 SEK. Details in `boat-crossings-A/B.md`
  (local, `../data/`).
- **Shop hours**: confirmed limited (STF hut shops open ~when the warden is on duty,
  no fixed published hours; village ICAs = normal grocery hours; not 24/7). No reliable
  per-shop table exists publicly — a follow-up is to research the specific critical
  resupplies (the ICAs at least). This is why the per-day POI crossing times exist.
- Aug-15 Kebnats→Vakkotavare bus confirmed (10:55 / 16:50). Abisko→Kiruna = replacement bus.

## 8. Fast facts
- Deployed tip: `123b21a`. inthetech.dev. Build badge = SHA.
- 18 overnights, Aug 2 (km 7) → Abisko Aug 19 (km 460); trail totalKm ≈ 459.98.
- Prior handoffs in `docs/handoffs/` (this session committed the untracked ones).
