// Shared POI labelling for the Kungsleden map builder (build-gpx.ts).
// Turns a Naturkartan "Category – Name" title into a short "<emoji> <place>" label
// so Garmin's list view doesn't truncate the place name away. Tune the rules HERE —
// both builders import them, so they can't drift apart.

// type -> emoji marker.
export const EMOJI: Record<string, string> = {
  Accommodation: "🛏️", Cabin: "🛏️", Camping: "⛺", Shelter: "🛖", Sauna: "🧼",
  "Rest area": "🪑", Firesite: "🔥", Toilet: "🚾",
  Bridge: "〰️", Parking: "🅿️", Information: "ℹ️", "National Park": "🌍", Viewpoint: "👁️",
};

export const SYM: Record<string, string> = {
  Cabin: "Lodging", Accommodation: "Lodging", Shelter: "Lodging",
  Camping: "Campground", Toilet: "Restroom", "Rest area": "Picnic Area", Firesite: "Picnic Area",
};

// Strip STF, leading nouns (Tent pitch / Latrine …) and generic hut/station words so the place name leads.
const GENERIC = /\b(Mountain cabin|Mountain station|Cabin village|Turiststation|Fjällstation|Fjällstugor|Fjällstuga|Fjällcenter|Fjällgård|Visitor centre|Naturum|Värdshus|Wärdshus|Stugby|Stugor|Bastu|Camping|Utedass|Dass|Rastplats|Rastskydd|Grillplats|Eldstad|Suspension|bridge|cabin|station|hut|AB|och|Vindelfjällen)\b/gi;
export const shorten = (spec: string): string => {
  let s = spec.replace(/^STF\s+/i, "").replace(/\s*\/.*$/, "");   // drop STF prefix + slash-alternative names
  s = s.replace(/^(Tent pitch|Camping|Latrine|Utedass|Dass|Toilet|Rest area|Fire ?site|Firesite|Wind ?shelter|Vindskydd|Shelter|Bridge|Sauna|Rastplats med eldstad|Rastplats|Rastskydd|Grillplats|Stopover)\s+/i, "");
  s = s.replace(GENERIC, "").replace(/stugan?\b/gi, "").replace(/,.*$/, "").replace(/\s+/g, " ").trim();
  return s || spec;
};

export const primaryOf = (f: any): string =>
  (f.properties.name || "").includes(" – ") ? (f.properties.name as string).split(" – ")[0] : "";
export const cats = (f: any): string[] =>
  (f.properties.description || "").split(",").map((s: string) => s.trim()).filter(Boolean);

// "Category – Name" -> "<emoji> <place>"; a name without the separator is just shortened.
export const label = (fullName: string): string => {
  const i = fullName.indexOf(" – ");
  if (i < 0) return shorten(fullName);
  const cat = fullName.slice(0, i);
  return `${EMOJI[cat] || cat.slice(0, 2)} ${shorten(fullName.slice(i + 3))}`;
};
