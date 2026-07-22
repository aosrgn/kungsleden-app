# 2026-07-16 · Design Detail & v2 Recovery Notes

Companion to `2026-07-16-thread-consolidation.md`. That doc captured *what was decided*. This one captures *why* — the reasoning behind non-obvious choices, plus the shelved-for-v2 designs so we don't lose them.

Read this second, only if you're touching something covered here or trying to understand why the current design is the shape it is.

---

## 1. Pace model — the exact numbers and why not Naismith

The pace/time projection function is calibrated from personal observations, not a generic hiker model. The specific data points:

| Observation | Result | Implication |
|---|---|---|
| 20 km / 337 m gain in 4h30, ~12 kg pack | **4.4 km/h** on easy terrain, loaded | Baseline flat sustainable pace |
| 15 km / 1720 m gain in an afternoon | **~1150 m/h vertical** at full effort | Peak climbing rate |
| 32 km / 1500 m gain over 2 days | Comfortable multi-day capacity | 2-day rolling capacity |
| Winter Karhunkierros, 80 km / 6 days on skis (March) | Solid multi-day endurance | Multi-day tolerance |

**Derived function parameters** for `segment_time(dist_km, gain_m, loss_m, expected_kmh)`:
- Sustainable loaded pace on Kungsleden mixed terrain: **~3.5–4 km/h blended**
- Sustainable vertical with pack: **~600–800 m/h**
- Comfortable daily mileage at relaxed pace: **26–28 km**
- Pushable when needed: **30–35 km**
- Daily walking time at 26 km/day average: **~8 hours**

### Why not Naismith
Naismith's rule (1 h per 5 km + 1 h per 600 m ascent) is a generic 1892 formula for a fit walker without pack. It:
- Understates flat pace for this hiker (predicts 5 km/h flat vs. observed sustainable 4.4 km/h with load; but overstates when tired)
- Doesn't account for pack weight consistently
- Doesn't have the descent-slows-you term that Kungsleden's rocky descents demand
- Would need multipliers for terrain (rocky vs boardwalk vs road) that we deliberately rejected

### Why not a learned coefficient model
Explicitly rejected in the original brief. Multiplicative coefficients (`terrain × weather × fatigue × pack`) are:
- Overfit to a training corpus we don't have
- Under-calibrated (18 days of data can't cover all combinations)
- False-precision — implies more accuracy than the underlying signal has
- Un-inspectable ("why did it say 4h30?" — the model can't tell you)

### The adopted approach
- Fixed `segment_time` from the numbers above (baked into code, not learned)
- User sets **one number per day**: "expected pace today" (Slow 3.0 / Normal 3.5 / Fast 4.0 / custom)
- The hiker mentally integrates terrain + weather + fatigue into that single number
- **Observed pace** (rolling from GPS movement) is shown as sanity check only, never used in forward projection
- All ETAs use `expected_pace` from the user knob

**Guardrail:** if observed pace diverges from expected by >~15% for ≥30 minutes, the app should flag it as "observed 2.8 km/h vs. expected 3.5 — update expectation?" — not silently adjust.

---

## 2. Why the app is a PWA and not native/Capacitor

Discussed and rejected two alternatives given the one-week deadline:

### Real native (Swift + SwiftUI)
- **Rejected because:** new stack, Xcode signing, App Store or ad-hoc distribution, whole UI to rebuild. Realistic time: 3–4 weeks even for someone experienced. In one week: no.
- What it would have bought us: bulletproof offline storage (unevictable app bundle assets).

### Capacitor (WKWebView wrapper around the existing Vue code)
- **Tempting because:** reuses all existing Vue code, bundles PMTiles as iOS app assets (unevictable), fixes the iOS geolocation bug that plagues standalone PWAs (native geolocation via Capacitor plugin).
- **Rejected because:**
  - Requires Apple Developer account ($99/yr) and Xcode-signed IPA
  - **Kills the "push → GitHub Actions deploy → refresh on phone" loop entirely.** Any on-trek bug means rebuilding the IPA — impossible from an iPhone at a hut. This was a core design pillar from the original brief.
  - WKWebView compatibility quirks are their own rabbit hole
  - Time: 2–4 sessions if it goes well, 6+ if it doesn't

### The PWA path (chosen)
- Preserves the deploy loop entirely
- Accepts a small residual risk: rare IDB purge mid-trek → offline map missing → planning UI still works (data baked into JS bundle) → nav app covers actual navigation
- Trade-off is explicit and matches the "graceful degradation" principle

---

## 3. Storage architecture — why single-path

Original proposal was three storage layers (Cache API + IDB + file-import backup). User pushed back:

> "This seems more complex than you are making it look like, those are 3 ways to load the maps, three completely different ways, with their own bugs, risks, etc. No I want one final way of loading and be sure I can rely on it."

That's correct — multi-path is complexity dressed as safety. Each path has its own bugs, its own failure modes, and the interaction between them is worse than any single one.

### Single-path chosen
- **PMTiles blob + `diary.csv` + `kungsleden.geojson`** all in IndexedDB, via `idb-keyval`
- MapLibre reads PMTiles through a Blob URL via the `pmtiles://` protocol handler
- `navigator.storage.persist()` requested at first save. Installed PWAs on iOS 17+ typically get it granted silently.
- **Startup verification badge**: hash-check the PMTiles blob against a baked-in expected hash on every app open. Show 🟢 `Offline map · 147 MB · verified 2026-08-04` or 🔴 `Offline map missing · tap to redownload`.
- Settings screen has a file-picker to re-upload the PMTiles/diary/geojson if needed.

### The residual risk we accepted
- iOS Safari *could* purge IDB under extreme storage pressure or after very long inactivity.
- If it does mid-trek: startup badge turns red. Nav app still works. Planning data (few KB of JSON baked into JS bundle) still works. Just the *map wallpaper* is gone.
- This is acceptable because we have a separate nav app for real navigation.
- Pre-trek confidence ritual (below) verifies the mechanism empirically before departure.

### Pre-trek confidence ritual (from `thread-consolidation.md`, restated for prominence)
1. On WiFi at home the day before departure: install PWA to home screen, tap "Download offline map," see green badge.
2. Airplane mode. Force-quit. Reopen. Confirm map loads at every zoom.
3. Leave phone in airplane mode overnight. Next morning, reopen. Still green.
4. Fly to Hemavan. Land in airplane mode. Reopen. Still green.
5. If steps 1–3 pass: IDB with persist() granted doesn't fail at hour 25 that failed at hour 24. If it survives 24 hours, it survives the trek.

---

## 4. Diary-as-runtime-input — full workflow

`diary.csv` (from `../data/`) is not baked into the app bundle. It's a *runtime input* stored in IndexedDB alongside the map tiles, replaceable via a file-picker in Settings.

### Why runtime instead of build-time
- The diary WILL change during the trek (bus schedules confirmed, boat times updated, new POI discovered, plans shifted for weather).
- Redeploying the PWA requires WiFi + a Claude Code session + waiting for Actions. That's fine for bugs, but a diary update is a data update — heavier machinery than necessary.
- Runtime replacement means: edit locally (or via CC session at a hut), sync to iCloud Drive, one tap in the PWA, done. No redeploy, no waiting.

### The regeneration flow

**Home / pre-trek:**
1. In `~/Development/kungsleden/data/`, edit `diary.csv` (or the source it's built from) and re-run `npm run diary` if needed.
2. Copy `diary.csv` to your iCloud Drive `Kungsleden` folder.
3. In the PWA Settings, tap "Replace diary.csv" → iOS Files picker → select the fresh CSV.
4. All stats panel numbers recompute against the new data.

**On trek at a hut with WiFi:**
1. Resume a Claude Code session (cloud or via phone terminal) against `~/Development/kungsleden/data/`.
2. Describe the change ("Sitojaure boat operator confirmed 10:00 daily this week").
3. Claude Code edits the diary CSV.
4. You save the file to iCloud Drive (or Claude Code does it via a script).
5. Open the PWA → Settings → Replace → done.

### App behavior
- Ships with a bundled default `diary.csv` (last snapshot at build time) as fallback.
- On first launch, if user hasn't uploaded a diary, uses bundled default. Badge shows: `Trip data: bundled (v: 2026-07-14)`.
- On upload, stored in IDB with metadata (upload date, row count, checksum). Badge shows: `Trip data: current (v: 2026-08-04 · 118 rows)`.
- If IDB is purged: falls back to bundled default automatically. Badge alerts.

### CSV parsing detail
- Semicolon-delimited (European CSV convention — the diary uses `;`, not `,`).
- Parse in-browser (Papa Parse or similar lib; something small).
- Same schema applies to bundled and user-uploaded. **Decided 2026-07-21:** no schema-version cell — the parser rejects an uploaded CSV whose header row doesn't exactly match the expected columns (clear error, keep previous data). Catches wrong-file/stale-copy/renamed-column without changing the diary format for any consumer.

---

## 5. Stats panel — the narrative recap

Every number on the panel is derived from three inputs: **current position** (GPS → cumulative km via projection), **expected pace today** (user knob), **static trip data** (diary + GPX). Any input change → whole panel recomputes.

### Right now (this hour)
Just factual, no computation beyond distance/time math:
- `km 187 · Section B · elev 480 m`
- `sunset 21:14 · 6h 43m of daylight left`
- (Weather now / next 24h if cached from last online moment)

### Today (rest of today)
- **Diary-planned stop:** shows whichever 🌙 row is scheduled for today's date. `Diary → camp km 214 · ETA at your pace 20:37`.
- **Huts reachable in end-of-day window:** filter huts along the trail where `ETA ∈ [16:00, 22:00]`. Display each with distance + name + amenities. Ranked by ETA.
- **Stop-time table:** if I stopped walking at each hour (16:00, 17:00, ..., 22:00), where would I be? One row per hour, showing `km reached · nearest POI (offset ± X km)`. Uses `expected_pace` from current position and current time.
- **Next gate today:** if any hard-time-window gate falls within today's projected reach, show it prominently: `⏰ Vuonatjviken boat km 189 · pre-booked 15:00 · ETA 14:35 · on track`.

### On time (trip-level)
- **One line, four projections:** projected Abisko finish under four pace scenarios simultaneously, so you see a range:
  1. **Expected pace** (the user knob) — your intent
  2. **Today so far** — shown only after ≥2h walked (early-day pace is noisy)
  3. **Yesterday's pace** (or last full walking day) — cleaner than "last 3 days" mid-day
  4. **Trip average so far** — pessimistic anchor, drifts less over the trip
- Each shows `Aug 19, 17:30 · ✅ 2 buffer days` or the scary version `Aug 21, 03:00 · ⚠️ cutting it very close`.
- If the four cluster: high confidence. If they diverge widely: something's up (bad terrain day, tired, weather).

### Elevation-adjusted on-track ratio
Better than raw pace for "am I actually behind":
- Compute "expected time" for the distance covered today so far, using `segment_time(dist, gain, loss, expected_pace)` — this accounts for terrain.
- Compute "actual time elapsed" since day start.
- Ratio: `time_progress = actual_time / expected_time_for_distance_covered`.
- Display: `Time progress today: 87% of expected for distance covered · ⚠️ slightly behind`.
- This handles "I've only done 6 km but it was up Tjäktja pass" correctly, whereas raw pace would say you're crawling.

### What was cut (not on the panel)
- Full DP planner day cards (see §6)
- Drag-to-reshuffle overnight pins
- Diff display on plan change
- Food inventory tracking (user manages mentally)
- Elevation profile chart
- Mobile coverage warnings
- Landmark countdowns
- Water source proximity

---

## 6. Full DP planner — v2 recovery notes

Cut from v1 to fit the 6-session week. If revived after the trek, here's the design so nothing is re-derived.

### Framing
- State variables per day: `end_km[day]` — where you sleep tonight (continuous, tent-anywhere → 1-km buckets over the whole trail).
- Transitions: `(day d, end_km e) → (day d+1, end_km e')` where `e' - e ∈ [min_km, max_km]` (feasibility).
- Time is implicit: given a fixed daily start time (09:00) and pace, arrival at any km within a day is derived from `segment_time(e, e', pace)` cumulatively.

### Hard constraints ("gates")
Each hard constraint = `(km, TimeWindow[], booking_mode, cash?)`. Feasibility check on any transition: does the timeline through day d+1 cross a gate km within a valid window on the correct calendar day?

Real gates (from `../data/diary.csv`):
- Abisko flight deadline (km 460, Aug 19 evening + 2 buffer days)
- Vuonatjviken boat (km 189, pre-book phone)
- Sakkat boat (km 254, 09:30 / 11:30 / 19:00)
- Laitaure boat (km 293, **09:00 & 17:00 only, flag-signal, 300kr cash**)
- Sitojaure boat (km 305, pre-book from Aktse — no signal at pier)
- M/S Langas + bus (km 324/352, ~10:00 boat → 10:55 bus — **2026 irregular**)
- Teusajaure boat (km 367, 09:00 / 15:00 / 18:00, flag-signal, 150kr cash)
- Alesjaure boat (km 425, optional, 500kr)

### Soft preferences (scored)
- Hut proximity: bonus if `end_km` within ~1 km of a hut (fallback shelter)
- Sauna: bonus if end_km at sauna hut AND days_since_last_sauna ≥ 4
- Day-km U-shape: penalty if day_km > 32 or < 18
- Wild-camp water source: bonus if end_km near known water
- Previous-plan stability: small bonus for end_km matching yesterday's plan (tie-breaker to reduce diff noise)

### Algorithm
- Standard DP (backward from `(day N, ≥ Abisko km)` to `(day 0, Hemavan km)`) computing `best_score[d][e]`.
- Runtime: ~18 days × ~460 km-buckets × ~30 next-day-reachable = ~250k edge evaluations. Sub-100ms in JS.

### Why DP over a general constraint solver (comparison preserved from design discussion)

Three solver families were considered before settling on hand-rolled DP:

**CP-SAT (Constraint Programming, e.g. Google OR-Tools).** Declare integer/boolean variables and logical constraints; the solver searches. Would model as `overnight_km[day] ∈ km_grid`, monotonic-forward + max-daily-km + anchor + gate-time constraints, maximize soft-preference sum. JS bindings exist but are rough (native library shimmed via WASM). Powerful but heavyweight for this size.

**MILP (Mixed-Integer Linear Programming).** `glpk.js` runs in browser. Constraints and objective must be linear — "prefer hut" is a binary variable × weight; "sauna every 4 days" is awkward to linearize. Solver overhead dwarfs the actual problem.

**SAT / SMT.** Pure logical satisfiability. Overkill — the problem is continuous-ish distances plus modest time-window logic, not booleans.

**Why hand-rolled DP wins:** the problem shape is a **DAG shortest/best path**, not a general CSP.

- State space is tiny: 18 nights × ~460 km-buckets (or fewer with corridor pruning) ≈ **8,000 nodes**.
- Fan-out per state is ~30 (next-day reachable end_km values within min/max daily km). Naive worst-case `40^18 ≈ 10^28` looks scary, but with monotonic-forward + max-day-km pruning the actual reachable graph is `~8^18 ≈ 10^16` unpruned — which is still too many to enumerate, but **that's not what DP does**. DP computes each `(day, end_km)` state once, taking the best over its ~30 successors. Total work: **~250k edge evaluations. Milliseconds.**
- Top-K paths (needed for day-card scenarios) is **Yen's algorithm on the same DAG** or K-best DP. K = 3–4 in practice. Also fast.
- Time-of-day for gate checks is *derived* along each path (start-of-day clock + cumulative segment_time), not a state variable — keeps the state space small. If flexible start times are needed later, add a 3-bucket start_time state (early/normal/late) → state × 3, still tiny.

**Concrete wins over pulling in a solver library:**

- **Full control over scoring.** No wrestling with linearization or CP modeling primitives.
- **Trivial debuggability.** "Why did it pick Pårte on day 12?" → print `best_score[d][e]` values and back-pointers along the chosen path. A solver gives you an answer, not an explanation.
- **No WASM dependency.** OR-Tools/glpk both ship WASM blobs measured in MB. Kills PWA bundle size and adds iOS Safari fragility.
- **No library breakage risk.** Constraint solver JS bindings have low maintainer activity; a hand-rolled algorithm won't break under a library update.
- **Plan-stability tie-breaking is one line.** Add a tiny bonus to nodes matching yesterday's plan → dedupes noisy diffs when inputs barely change. Doing this cleanly in a solver requires a warm-start API and hoping the solver honors it.
- **Gate-violation diagnosis is natural.** If no feasible path exists, walk backward from the failure state and report which gate broke first ("can't make Sitojaure boat on day 14 at this pace — try day 13 or slow to day 15"). Much more actionable than "UNSAT."

Verdict: **~200 lines of DAG + DP** beats any solver library for this problem. Rule of thumb: solvers pay off when constraints are gnarly and interconnected (nurse scheduling across wards with skill matches). Kungsleden's constraints are local and ordered — DP native.

### Top-K paths for day cards
- Yen's algorithm on the DP graph, or K-best DP.
- K = 4 typically. Powers the "day cards" scenario UI (stop early / normal / push / rest day).

### What top-K enables that the stats panel doesn't
- 3–4 alternative day-plans as cards with scores
- Full trip re-plan when you drag an overnight pin
- Diff display on plan change (highlight which days moved)
- "What if I add a rest day here?" recomputation

### If not implementing DP but wanting top-K
The stats panel's "stop-time table" is essentially top-N ranked by different stop times. Extending it to also compute the *downstream consequences* of each stop (does today's Abisko projection change if I stop at 6pm vs 8pm?) gets you 70% of what day cards provide without the full DP.

---

## 7. Umbrella folder migration (2026-07-16 afternoon)

Not directly app-dev, but relevant for any future session opening this repo.

The three project folders were consolidated:
- **Before:** `~/Development/kungsleden-map/`, `~/Development/kungsleden-power/`, `~/Development/kungsleden-app/`
- **After:** `~/Development/kungsleden/{data,power,app}/` (map renamed to data)

Path references in this repo (`CLAUDE.md`, `docs/handoffs/`) use `../data/` and `../power/` — the sibling folders under the umbrella.

Claude Code project dirs (`~/.claude/projects/-Users-adrian-Development-kungsleden*/`) are symlinked so that sessions started from any sub-folder land in the same unified thread inbox at `-Users-adrian-Development-kungsleden/`.

**Backward-compat symlink:** `~/Development/kungsleden-power → ~/Development/kungsleden/power` exists to keep pre-migration sessions' hardcoded CWD from breaking. Safe to remove once no such sessions remain.

---

## Cross-references

- Loop validation (v1 static + v2 Vite), basemap saga, iOS geolocation, cloud thread history, v1 scope, week plan, hard-constraint table: `./2026-07-16-thread-consolidation.md`.
- Trip data authority + regeneration flow: `../data/CLAUDE.md` (if it exists) or `~/.claude/projects/-Users-adrian-Development-kungsleden/memory/project_kungsleden_map_data.md`.
- Umbrella layout + Claude Code project dir mechanics: `~/.claude/projects/-Users-adrian-Development-kungsleden/memory/project_kungsleden_two_repos.md`.
