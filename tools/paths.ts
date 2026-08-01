// Shared paths for the diary/GPX generators, relative to the app project root (the cwd
// when the `npm run diary|diary:md|gpx` scripts run). diary.csv + kungsleden.geojson are
// the app's baked-in authoritative copies in public/data/; the rest live beside the
// scripts in tools/. (export.ts, the Naturkartan API pull, stays local in ../data/.)
export const DIARY = "public/data/diary.csv";
export const GEOJSON = "public/data/kungsleden.geojson";
export const DIARY_B = "tools/diary-B.csv";
export const BASE_GPX = "tools/kungsleden-base.gpx";
export const FIELD_GPX = "tools/kungsleden.gpx";
