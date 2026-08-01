# 2026-07-21→24 · Session findings (trip plan, food, health, power)

> **⚠️ SUPERSEDED (2026-07-24, later same session).** The 17-day / Tjulträsk plan described below was reverted: **Tjulträsk dropped** (no car shuttle → 30 km day), reflowed to **18 walking days + 2 buffer, ≤26.5 km/day with an ease-in, Abisko Aug 19, mainline via Aigert.** This file is kept as a point-in-time record — for the current plan see `../../../data/diary.csv` (authoritative), `../../../data/OPEN_QUESTIONS.md`, and memory `kungsleden-shortcut-rule`.

A long multi-track thread. This is the index of everything decided/found; details live in the linked docs. Nothing here is app-code — it's trip planning across `../data/` and `../../power/`.

## 1. Trip plan — re-flowed to 17 days

**Shortcut rule (memory: `kungsleden-shortcut-rule`):** time is short → take every available shortcut.
- **Three boats now PLANNED** (were optional/unevaluated): **Tjulträsk** valley boat (Day 3, Serve→Ammarnäs, saves ~14 km walking, skips Aigert), **Bäverholmen** (Day 6, skips 7.1 km into Adolfström), **Alesjaure** (Day 16). Boat-completeness sweep done — all 9 route boats captured, none missed (recorded in `../data/OPEN_QUESTIONS.md`).
- **Re-flow: 18→17 walking days + 3 buffer, arrive Abisko Aug 18**, full walking days ~25 km hiked. Transfer day is now **Day 13 (Aug 14)**. All camp dates/km shifted; propagated through `diary.csv`, `transport.md`, `booking-checklist.md`, `kungsleden-trip-plan.md`, `OPEN_QUESTIONS.md`, `power/POWER_NOTES.md`, memory.
- **Return corrected** (was a misrecording): **09:50 Sat Aug 22 is the ARN→home flight, ticketed.** Plan = Fri Aug 21 train Abisko→Kiruna (~16:46) → **SAS KRN→ARN 21:05→22:40 (to book)** → overnight near Arlanda. Night train (Abisko Thu → Arlanda Fri) deliberately NOT planned (mental fallback only).
- **Nav-GPX splice done:** the Tjulträsk valley detour (682-pt hand-traced line) is spliced into `../data/kungsleden.gpx` as one continuous route; `export.ts` folds any `data/tracks/*.gpx` in on regen. GeoJSON keeps the canonical mainline (stable diary km) + the detour as a separate feature.

## 2. Food & resupply

**STF shop sizes captured** from the two 2025 price-list PDFs. On route: Large = Viterskålet, Tärnasjö, ~~Aigert (skipped)~~, Aktse, Sälka, Alesjaure, Abiskojaure. Small = Teusajaure, Kaitumjaure. Villages (full) = Hemavan, Ammarnäs, Adolfström, Jäckvik ICA, Kvikkjokk, Saltoluokta, Abisko. **Only BOLD price-list items are all-season reliable; italic = peak-season while-stocks-last.**

- **Diary got two new columns** (`build-diary.ts` COLS extended): **`shop_size`** (village/large/small/none per hut) and **`buy_here`** (per-stop meal counts to reach the next shop). Two real carries: Ammarnäs→Adolfström (~3 d) and Jäckvik→Kvikkjokk (~3 d, longest); elsewhere top up ~1 day + 1–2 spare dinners.
- **`../data/food-plan.md`** (new): meal shape, vegetable/fiber/mineral strategy (**forage wild blueberries — peak August, low-FODMAP/GERD-safe** — is the headline fix), varied recipe rotation, per-meal portions (~500 kcal/meal, ~2,700–3,000/day), and **per-stop grab-and-go shopping lists in package units.**
- **Dietary constraints** → memory `user-dietary-constraints` (GERD, SIBO/FODMAP buildup, histamine AM/lunch + DAO, no corn/lentils, beans occasional; 4-meal structure; TOAKS 650 mL cup only — skip pan + big pot; no frying = GERD).
- **Reservation-restaurant timing:** Bäverholmen lunch ~13:00 d6 works; **Vuonatjviken ~11:00 d8 does NOT** (carry that lunch). Confirm both by phone when booking the boats.

## 3. Health & hygiene → `../data/health-hygiene.md`

New doc. Highlights: permethrin+picaridin system (decant picaridin to ~60 ml; merino hoody bites-through at pressure points → keep permethrin fresh, don't wash it week 1); wild-toileting official Swedish guidance (**100 m** from water/trail, rock-cover when unable to dig, pack out TP in parks); **norovirus** (documented 2023 Kungsleden outbreak, **soap+water not hand-sanitiser**, treat drinking water — your biggest vector, not the dass).

## 4. Power → `../../power/POWER_NOTES.md`

**Sim fully updated and run: P(safety floor breach) = 0%.** Safety/comfort devices stay 100% all trek. Filming (drone/Osmo) is the flex load — fine in good weather, the first thing to ration in a bad stretch.

- Fixed inputs: `devices.json` (measured — both Gen2 banks healthy ~30–31 Wh via iPad test, retired the "degraded B" assumption; Gen4 workhorse + Gen2 reserve; iPhone 88% SoH; NU25 UL headlamp), `huts.json` (diary km, **Adolfström/Jäckvik un-reversed**, Teusajaure added, phantom Kebnekaise removed), `route.json` (rebuilt 17-day).
- **Charging (verified):** MO18 = 30 W (15+15 dual-port). **A 1 h stop ≈ 2 h ≈ ~28 Wh** — enough to keep filming at 73–97% all trek via top-ups during resupply stops you already make. **Safety needs zero wall charge** (solar covers it). Both DJI devices cap at ~15 W = perfect for the 15 W/port dual mode (Neo+Osmo both full in ~1 h). DJI charge speeds verified: Neo 15 W, Osmo ~12–15 W.

## 5. Open decisions (not yet actioned)

1. **Saltoluokta hut-night?** — the one worthwhile power upgrade (full charge before the no-mains northern gap), near-free re-cut, keeps buffer days. Recommended: wild-camp + this one hut-night + 1 h top-ups at resupply stops.
2. **Build `data/src/build-route.ts`** to generate `power/route.json` from the diary (tie, don't merge) + move electricity flag into the diary. Waiting on the hut-night decision.
3. **Bookings (time-sensitive):** SAS KRN→ARN Fri Aug 21 + Arlanda hotel; Tjulträsk (Vinka, **before trek** — valley has no coverage); Aug 14 bus (irregular 2026); Bäverholmen/Vuonatjviken meal-timing confirms; Vuonatjviken/Sitojaure/Bäverholmen/Alesjaure pre-books. Full list in `../data/booking-checklist.md`.

## 6. App (untouched today)

PWA Session 1 (strip basemap saga from `MapView.vue`, drop LM secrets from `deploy.yml`, render the trail) is still the next code step whenever picked up. Note: when Session 2 builds the diary-upload header-validation, the canonical CSV header is now **20 columns** (added `shop_size`, `buy_here`), and the PWA map will eventually need to draw `type:"detour"` features (the Tjulträsk line) distinctly from `type:"trail"`.
