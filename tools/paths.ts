// Shared paths for the diary/GPX generators, relative to the app project root (the cwd
// when the `npm run diary|diary:md|gpx` scripts run). diary.csv, kungsleden.geojson and
// the generated field GPX are the app's baked-in authoritative copies in public/data/ —
// the GPX lives there so the app can serve it to the phone's share sheet. Inputs that the
// app never reads stay beside the scripts in tools/. (export.ts, the Naturkartan API pull,
// stays local in ../data/.)
export const DIARY = "public/data/diary.csv";
export const GEOJSON = "public/data/kungsleden.geojson";
export const DIARY_B = "tools/diary-B.csv";
export const BASE_GPX = "tools/kungsleden-base.gpx";
export const FIELD_GPX = "public/data/kungsleden.gpx";
