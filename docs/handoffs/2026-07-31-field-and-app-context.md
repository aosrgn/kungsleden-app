# 2026-07-31 · Full field + app context (for cloud Claude)

**Purpose.** Maximum-context handoff so a cloud Claude Code agent, driven from Adrian's phone during the Aug 2026 Kungsleden trek, can answer field questions and make app fixes **without re-researching, re-debunking settled decisions, or re-searching info we already have.** Read this whole file before acting. Everything below is either a stated fact from the trek data, a research finding (sourced), or a settled decision (with the reasoning). Where something is unverified it says so — keep it that way (see "Working style").

---

## 0. Working style (non-negotiable)

- **Provenance / no guessing.** NEVER state inferred logistics (cell signal, booking deadlines, prices, coverage, "it's dry/wet") as fact. Source it or label it **unknown**. Adrian fact-checks against the real map and has caught guesses (see reversals). Memory: `feedback-provenance-no-guessing`.
- **Commits.** Atomic (one logical change). **NEVER commit without explicit approval.** Single-line title `type: description`. No body. No `Co-Authored-By`. No scope-in-parens. **NEVER push** unless asked.
- **Changes.** Minimal only; don't "improve" unrelated code. Surface forced choices with a recommended default. Check in before non-trivial changes. Golden rule: **YAGNI → KISS → SRP/SoC → POLA → DRY → Performance.**
- Verify claims empirically; don't dismiss firsthand observations.

---

## 1. Repos & layout (`~/Development/kungsleden/`)

- **`data/`** — trip-data authority. **NOT a git repo.** Node/TS via **devbox** (nodejs only, NO python in devbox — use system `python3` for ad-hoc). Produces the GPX/geojson and the markdown field docs.
- **`app/`** — the planning **PWA** (this repo, `aosrgn/kungsleden-app`, branch `main`). Vue 3 + TS + Vite + vite-plugin-pwa. **Auto-deploys to GitHub Pages → [inthetech.dev](https://inthetech.dev) on push to `main`.**
- **`power/`** — battery/solar sim (independent Node CLI). Not touched by the app.

**devbox gotcha:** `devbox run -- tsx …` FAILS (devbox treats `tsx` as a script name → exit 127). Use the npm scripts (`devbox run -- npm run <x>`) or `devbox run -- npx tsx …`.

---

## 2. The trip

- Solo thru-hike **Hemavan → Abisko, ~460 km, Aug 2–19 2026** (18 walking days + 2 buffer), **no Kebnekaise**, mainline via Singi.
- Day 1 = 7 km ease-in (Camp Day 1 = km 7). Cap **≤26.5 km/day**.
- **Out:** Fri **Aug 21 flight KRN→ARN, SAS 21:05→22:40 (booked)**; overnight Arlanda; **Sat Aug 22 09:50 ARN→home (ticketed, hard deadline).**
- **Two plans, decide at Serve on the trail:**
  - **Plan A** = mainline via Aigert (`diary.csv`).
  - **Plan B** = **Tjulträsk boat shortcut** Serve→Ammarnäs on **Day 4** (`diary-B.csv`): banks ~14 km / ~½ day, camps Day 4–17 shifted +14 km, Aigert dropped, finishes ~½ day early. Take B **only if** the fragile Tjulträsk pre-book (Vinka bros, **no signal in the valley → arrange before the trek**) is confirmed; else walk A.

---

## 3. Data pipeline (`data/`)

**Source of truth:** `diary.csv` (Plan A) + `diary-B.csv` (Plan B). Semicolon-delimited European CSV (comma decimals). 24 columns:
`icon;name;type;date;overnight;from_start;to_next_hut;hiked;not_hiked;total;to_next_food;to_next_sauna;crossed_km;lat;lon;shop_size;buy_here;recharge;wifi;laundry;card;notes;source;url`

- `type` ∈ hut · shop · restaurant · sauna · boat · bus · train(now bus) · flight · hotel · landmark · shelter · camp · divider. `overnight="x"` = camps (🌙).
- **AUTO columns (don't hand-edit):** `icon`, `from_start`, `to_next_hut`, `hiked/not_hiked/total`, `to_next_food`, `to_next_sauna`. Set by `build-diary.ts`.
- `crossed_km` = not-hiked segment length (boat/bus rows). `shop_size` ∈ village/large/small/none. `buy_here` = meals to next shop.

**Scripts / npm (`devbox run -- npm run <x>`):**
- `export` → `src/export.ts`: pulls Naturkartan (guide 97) → **`kungsleden.geojson`** (trail LineString + all POIs) + **`kungsleden-base.gpx`** (raw gpx). Uses `togpx`. Detours from `data/tracks/*.gpx` spliced in (currently empty).
- `diary` → `src/build-diary.ts`: reprojects `diary.csv` onto the trail line, recomputes km + distances, rewrites the CSV (icons + day-dividers). **For rows WITH lat/lon it only computes `from_start` — it NEVER overwrites coords.** Camps (no lat/lon) get coords FROM `from_start`. Rows with `from_start > 460` = fixed post-hike tail (coords kept).
- `diary:md` → `build-diary-md.ts diary.csv diary-A.md`. `diary:md:b` → reproject diary-B.csv + render `diary-B.md`.
- `gpx` → `src/build-gpx.ts`: **the field map builder** (see §4).
- Shared: `src/poi-labels.ts` (emoji labels).

---

## 4. Map / GPX system

| File | What | Consumer |
|---|---|---|
| `kungsleden.gpx` | **the field map** — emoji-labelled, 13 low-value POI categories trimmed, both plans' camps + boat/shop/sauna/bus/water pins | Garmin / Footpath / **Guru** |
| `kungsleden-base.gpx` | raw Naturkartan export (input to `build-gpx.ts`) | build only |
| `kungsleden.geojson` | raw trail + all POIs, GeoJSON | **the PWA** |

**`build-gpx.ts` flow:** reads `kungsleden-base.gpx`, drops POIs in `DROP` (Sauna→diary provides it, + winter/info noise: Snowmobile Ban, Quiet places, Valuable nature, Restricted area, Bird watching, Top, Attraction, Hiking, Entrance, Nature reserve, Culture, Fishing, Nature Center), emoji-labels the rest via `poi-labels.label()`, then appends: **camps** (A `🌙 A · D4 · km69`, B `🌙 B · D4 · km83`, shared days 1–3 + Abisko), **diary LAYERS** (🧼 sauna×14, ⛴️ boat×8, 🛒 shop×16, 🚌 bus×1) from `diary.csv` where `from_start < 461`, and a **`WATER`** array (`💧 Aktse — fill up`).

**Emoji scheme** (`poi-labels.ts` EMOJI map + build-gpx LAYERS/WATER; label = `"<emoji> <place>"`, `shorten()` strips `STF`/generic hut/station words):
🛏️ accommodation+cabins · ⛺ camping · 🛖 shelter · 🪑 rest area · 🔥 firesite · 🚾 toilet · 🧼 sauna · ⛴️ boat · 🛒 shop · 🚌 bus · 〰️ bridge · 🅿️ parking · ℹ️ info · 🌍 national park · 👁️ viewpoint · 🌙 camp · 💧 water.
Chosen deliberately (soap 🧼 for sauna, river 〰️ for bridge since no flat bridge emoji, earth 🌍 for NP, eye 👁️ for viewpoint, WC-sign 🚾 for toilet). **Garmin Explore IGNORES gpx `<sym>` on import → shows a flag** (research-confirmed, app + web); the **emoji-in-NAME is the per-POI signal that survives**. `<sym>` values still set (Lodging/Campground/… + Drinking Water) for apps that DO honor them.

**Boat-coordinate fix (important, done this session).** The diary boat coords were placeholders equal to the associated hut/village coord. Verified each against the trail's **open-water "jump"** (the straight segment where the trail crosses water). **Moved 5 boats to their boarding/approach bank** (where you signal & board, S→N route order = the jump's first endpoint), **kept 3** at their jetties:

| Boat | Coord now | Status |
|---|---|---|
| Bäverholmen | 66.28579, 16.55389 | kept (Wärdshus = off-trail shortcut departure) |
| Vuonatjviken | 66.48752, 17.12198 | **moved** → W boarding bank |
| Sakkat | 66.92594, 17.71902 | **moved** → S bank |
| Laitaure | 67.11750, 18.28942 | **moved** → S bank (hut Aktse is on the N side of this crossing) |
| Sitojaure | 67.20395, 18.42193 | **moved** → S bank |
| M/S Langas | 67.39409, 18.52076 | kept (Saltoluokta jetty = boarding) |
| Teusajaure | 67.68911, 18.14191 | **moved** → SW bank |
| Alesjaure | 68.13667, 18.41479 | kept (jetty = off-trail shortcut departure) |
| 🚌 Kebnats-Vakkotavare bus | 67.58169, 18.10037 | correct = Vakkotavare (alight/resume) |

Then **`npm run diary` recomputed km** — coords preserved (build-diary never overwrites located rows), `from_start` updated to the boarding positions; now internally consistent (boarding km + `crossed_km` = landing km). Route totals unchanged (hiked 409 + not-hiked 52 = 460).

---

## 5. Water (research-verified)

Water is a **non-issue for ~95% of the trail** — flowing stream every 1–2 h, drink untreated, 1 L bottle plenty. **ONE real dry carry:** **Aktse → Sitojaure plateau (~km 293–305, HIGH confidence, 3 sources)** — above the tree line, no water on top ~6–8 km. Fill at **Aktse**. Marked on the map (`💧 Aktse — fill up`, 67.14867/18.30590) + a diary note on the Aktse hut row. **Aktse water day: Plan A Day 13 (Aug 14) / Plan B Day 12 (Aug 13).**
**Vakkotavare→Teusajaure was DROPPED** — single source, and Adrian saw multiple streams on the plateau on the Fjällkarta. **Tjäktja pass (1150 m) is NOT dry.** Full reference: `data/water-zones.md`. Quality: drink moving water, avoid stagnant marsh; at huts use the marked drinking point (fill upstream, wash downstream); lemming-year caution.

---

## 6. Transport (confirmed this session)

- **Day 14 Aug 15 · Kebnats→Vakkotavare bus: CONFIRMED runs** — 10:55→12:00 (Falcks Omnibus buss 931) & 16:50→17:55 (buss 934), **213 kr**. Take the 10:55 (meets the ~10:00 M/S Langas boat from Saltoluokta). Both plans reach Vakkotavare on Day 14.
- **Abisko→Kiruna (Fri Aug 21): rail work → replacement BUS, not train.** 3 options that make the 21:05 flight: **SJ 16:30→17:50 (70 kr)** · SJ 16:31→17:51 (100 kr) · Länstrafiken 91 11:20→14:06 (pay onboard, most margin). Then **Boreal flygbuss** Kiruna→KRN (still to confirm a run meets 21:05).

---

## 7. Boats / crossings — "No boat, no hike"

Rule: hike every crossing; **self-row where that's normal**; refuse a motorboat that only copies a self-row; **take** a motorboat that cuts km (Bäverholmen −7 km, Alesjaure −6 km, the M/S Langas transfer −30 km). Full detail + phones/times/prices in `data/boat-crossings-A.md` / `-B.md`.
- **Vuonatjviken = the fragile one** — must-book, on-demand, **no land route around Riebnes** (no boat = no hike). Sandra +46 72 221 19 11 / Geir +46 70 206 65 27. Confirm it runs before Day 9.
- **Minimum booking lead time is UNKNOWN** for the on-demand boats (Bäverholmen, Vuonatjviken, Alesjaure) — arrange on the call. **Sakkat/Sitojaure rowboat question: abandoned — take the motorboat.**
- Laitaure: flag on the **south** bank, 09:00/17:00, 300 kr cash. Sitojaure: **call from Aktse** (no signal at the landing), cash. Teusajaure: self-row.

---

## 8. Food & bail-out (summaries; docs are authoritative)

- **`data/food-plan.md`**: 4 meals; **boil & drain** (Adrian's preference — was absorption; changed) in a **TOAKS 650 mL** cup, no frying (GERD); ~2,700–3,000 kcal/day; per-stop buy lists **in grams**; **gas ≈ 7 small (100 g) canisters** (my ESTIMATE — verify day 1–2); forage wild blueberries; cash **~2,000 SEK**. Dietary constraints (memory `user-dietary-constraints`): GERD, SIBO/FODMAP buildup, **histamine rich food AM–lunch only + DAO pill at lunch**, no corn, **no lentils**, beans occasional. Dinner tins = lower-histamine kind (canned chicken); fish/cured → lunch DAO window.
- **`data/bail-out.md`**: exits by zone; Abisko finish now uses the replacement bus (§6). populAir (inland flights) + Inlandsbanan (summer train, ends ~Aug 12) = southern bail options.

---

## 9. Research already done — DO NOT redo

- **Garmin Explore ignores gpx `<sym>`** on import (default flag; app + web) — never officially documented but consistent multi-year forum reports.
- **Nav app for iOS → Guru Maps** (Adrian installed it + took a sub). **Fjällkarta offline** via `johanberonius/Lantmateriets-Fjallkarta`: online source `https://custom-map-source.appspot.com/galileo-lantmateriets-fjallkarta.ms`; **offline ~400 MB** file `https://drive.google.com/open?id=1pWaaIDBzilVCYp3gXEdLgCF8TNQ8DQnK` → open in Safari → "Open in Guru Maps." Fjällkarta = the **discontinued classic** mountain map (still great for hiking). **Min Karta / Topowebb (current):** ready-made Guru sources `lantmateriets-topografisk.ms` / `lantmateriets-minkarta-bergodal.ms` on the same host, OR manual WMTS with a free Lantmäteriet open-data token: `https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/TOKEN/1.0.0/topowebb/default/3857/{z}/{x}/{y}.png`. (appspot host was intermittently 503.) **Locus Map** reads Garmin `sym` (Android only full app); **OsmAnd** needs its own `<osmand:icon>` extension; Gaia/Organic/Avenza/CalTopo don't do per-POI icons well.
- **Cell coverage: PARKED / UNVERIFIED.** Do NOT state coverage as fact anywhere. (Adrian caught a fabricated "no signal at Vuonatjviken" claim — that's how strict this is.)

---

## 10. Decisions & reversals — DO NOT re-litigate

- **Plan B (Tjulträsk)** was dropped in an earlier session, then **re-introduced this session** (A + B; decide at Serve). `diary-B.csv` exists.
- **`kungsleden-light.gpx` + its builder were created then DELETED.** The old `kungsleden-AB.gpx` **became the default `kungsleden.gpx`**; the raw export was renamed `kungsleden-base.gpx`. One map builder now: `build-gpx.ts`.
- **Codes (Sa/Br/WC…) → replaced with emoji** (per-type, §4).
- **Cash 3,500–4,000 → ~2,000 SEK.**
- **Vakkotavare water warning added → dropped** (Adrian's map showed streams).
- **Cooking: absorption → drain.**
- **Deleted docs (data/):** `MAP_DIARY_NOTES.md` (redundant work-summary), `TODO.md` (folded into boat-crossings/bail-out; open research abandoned as non-issues), `Footpath Export.gpx` (was the Footpath-`sym` research sample; not the OG track — the track comes from Naturkartan).
- **Current data docs:** `diary-A/B.md`, `boat-crossings-A/B.md`, `bail-out.md`, `food-plan.md`, `water-zones.md`, `BUILD_AND_APIs.md`, `CLAUDE.md`.

---

## 11. THE APP — scope (settled this session)

**A lean, offline, personal PLANNER PWA. Not a nav map** (Guru does nav). Vue 3 + TS + Vite + vite-plugin-pwa.
- **No tiles, no basemap, no MapLibre.** The view is a **scrollable ROUTE STRIP**: a vertical line with your position anchored near the top; **upcoming POIs from `diary.csv` as nodes down the line by km-ahead** (name · +km · ETA-at-pace); today's stop highlighted; scroll for further. Not a 2D map.
- **Data (`diary.csv` + geojson trail line) is COMMITTED with the app** (bundled at build). → **Drop** IndexedDB, `persist()`, verification badge, and the file-picker/upload+header-validation. Offline = **SW precache** of the app shell + bundled data.
- **Keep** the geolocation core from the current `MapView.vue` (the **iOS-18 standalone-PWA geolocation bug** 3-strategy fallback: `minimal`/`low-acc`/`delayed` + `watchPosition`). Known iOS bug — accepted workaround, don't re-debug.
- Trail LineString (from geojson) is needed to **project GPS → cumulative km**. diary.csv POIs drive the strip.

**Panels:**
- **NOW** — km · section · elevation · daylight left.
- **TODAY** (relative to current position) — planned stop + ETA · **huts you pass before the planned stop** · **+ the next hut if reachable ~2 h past the planned stop at pace**.
- **ON-TIME** — projected Abisko finish under **4 pace scenarios** (Slow 3.0 / Normal 3.5 / Fast 4.0 km/h / custom) · elevation-adjusted **on-track ratio** · **±days vs Plan A** (½-day steps) · **buffer days left** (½-day steps). Keep **both** the ±vs-A and buffer readouts — they're the same axis (buffer ≈ 2 + ±vs-A: on-A → ±0/buf 2; ½ behind → −½/buf 1.5; ½ ahead / Plan-B lead → +½/buf 2.5). Only Plan A's schedule is loaded; a Plan-B lead just shows as +½.
- **Pace input:** Slow/Normal/Fast/custom. No coefficient pace model — flat speed, elevation-adjusted for the on-track ratio.

**Manual UPDATE button (safety-critical).** vite-plugin-pwa `registerType: 'prompt'`: the SW downloads a new version at a wifi point but **HOLDS it — never auto-applies.** Current version keeps running until Adrian taps **Update**. Show a build-SHA badge (already stamped via `__COMMIT_SHA__`/`__BUILD_TIME__` Vite defines) to confirm the reload took.

**Cloud-fix workflow (already tested by Adrian, works).** From the phone at a wifi point → cloud Claude Code edits the repo → commit → push `main` → GitHub Pages auto-deploys → Adrian taps **Update**. Data fixes = edit the **bundled** CSV/geojson in this repo + push. Binding constraint = **signal** (villages + hut wifi only). Safety net = the SW serves the last-cached version until a deliberate Update.

**Current app code = essentially greenfield.** Only `src/components/MapView.vue` (336 lines: MapLibre + online basemaps [OpenTopo + optional Lantmäteriet WMTS + Waymarked Trails] + geolocation) and a 29-line `App.vue`. The app `CLAUDE.md` describes an older v1 scope (offline PMTiles, IndexedDB, upload) — **THIS doc supersedes those parts** (lean planner, strip, no tiles/IndexedDB/upload). Still-valid from app `CLAUDE.md`: the derived-view philosophy, the iOS geolocation workaround, the build-badge, GitHub-Pages deploy. **LM secrets (`VITE_LM_USER/PASS`) to be removed.** **NO v2** — whatever we build is the whole app (post-trek it's disposable).

---

## 12. App build plan + methodology (Adrian's chosen process)

**Phases (each = a small reviewable set of commits):**
1. **Foundation + trail** — strip `MapView` to the geolocation core (remove `maplibre-gl` + basemap code + LM secrets); bundle `diary.csv` + geojson trail; parse diary → typed POIs; render the **route strip** static (full trail top→bottom, POIs as nodes); PWA SW precache + build-SHA badge + **manual Update button** (`registerType:'prompt'`).
2. **Position → km** — project geolocation onto the trail → cumulative km + section; the **NOW** panel; drive the strip's position anchor.
3. **Planner** — **TODAY** (stop+ETA · huts passed · next hut if ~2 h past) + **ON-TIME** (4 paces · on-track ratio · ±days vs A ½-day · buffer days ½-day) + **pace selector**.

**Per-commit methodology:**
1. Produce a **per-commit plan**; review it with Adrian.
2. Implement commit N.
3. **Before committing, spin up a review subagent — model `sonnet` (Sonnet 5), effort high** — to check the work.
4. Apply fixes.
5. **Commit yourself (with Adrian's approval).** Never push.
6. Next commit.
7. When all commits done: **a final review subagent — model `fable` (Fable 5), effort high** — validates everything end-to-end; apply fixes; done.

---

## 13. Open / time-sensitive (from `data/boat-crossings-A/B.md`)

Pre-book: **Bäverholmen · Vuonatjviken (confirm it runs — fragile) · Alesjaure · Sakkat** boats; **(Plan B) Tjulträsk** (Vinka bros, before the trek — no valley signal); **Airport bus** Kiruna→KRN (Boreal — confirm a run meets 21:05). During hike: Sitojaure (call from Aktse), Laitaure (flag), Teusajaure (self-row). Carry **~2,000 SEK** cash.
