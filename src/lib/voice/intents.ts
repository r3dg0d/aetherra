/**
 * AETHERRA Voice command engine: pure utterance -> intent parsing. No browser or network code here,
 * so every rule is unit-testable. Intents carry the same hrefs the universal search uses, so voice
 * and typed search perform identical actions.
 */

export type VoiceIntent =
  | { kind: "navigate"; view: string; href: string; label: string }
  | { kind: "find-body"; body: string; href: string }
  | { kind: "find-constellation"; name: string; id: string; href: string }
  | { kind: "find-satellite"; name: string; norad: number; href: string }
  | { kind: "find-query"; query: string }
  | { kind: "imagery"; target: string; href: string; label: string }
  | { kind: "next-launch" }
  | { kind: "remind-next" }
  | { kind: "remind-all" }
  | { kind: "flights-near"; place: string }
  | { kind: "tonight" }
  | { kind: "time"; action: "pause" | "play" | "live" | "faster" | "slower" }
  | { kind: "layer"; layer: "lines" | "labels" | "grid" | "daylightStars"; on: boolean }
  | { kind: "help" }
  | { kind: "unknown"; suggestions: string[] };

export interface ParsedCommand { intent: VoiceIntent; confidence: number; normalized: string }

export const VOICE_SUGGESTIONS = [
  "Show me Jupiter", "Find Orion", "Where is the ISS?", "Mars rover photos", "Moon photos", "Jupiter Juno images",
  "When is the next launch?", "Remind me about the next launch", "What's visible tonight?", "Flights near London", "Pause time", "Turn off constellation lines",
] as const;

const VIEWS: [RegExp, string, string, string][] = [
  [/\b(sky|planetarium|star chart)\b/, "sky", "/sky", "Sky"],
  [/\b(earth|globe|map|streetlights)\b/, "earth", "/earth", "Earth"],
  [/\b(orbit|satellites?|tracking)\b/, "orbit", "/orbit", "Orbit"],
  [/\b(flights?|aircraft|planes?)\b/, "flights", "/flights", "Flights"],
  [/\b(launches|mission control|rockets?)\b/, "launches", "/launches", "Launches"],
  [/\b(ascent|simulator|fly the rocket)\b/, "ascent", "/ascent", "ASCENT"],
  [/\b(home|explore|start)\b/, "home", "/", "Explore"],
  [/\b(status|data sources|providers?)\b/, "status", "/status", "Data status"],
];

export const VOICE_BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const;

const CONSTELLATIONS: [string, string][] = [
  ["Andromeda", "And"],
  ["Antlia", "Ant"],
  ["Apus", "Aps"],
  ["Aquarius", "Aqr"],
  ["Aquila", "Aql"],
  ["Ara", "Ara"],
  ["Aries", "Ari"],
  ["Auriga", "Aur"],
  ["Bo\u00f6tes", "Boo"],
  ["Caelum", "Cae"],
  ["Camelopardalis", "Cam"],
  ["Cancer", "Cnc"],
  ["Canes Venatici", "CVn"],
  ["Canis Major", "CMa"],
  ["Canis Minor", "CMi"],
  ["Capricornus", "Cap"],
  ["Carina", "Car"],
  ["Cassiopeia", "Cas"],
  ["Centaurus", "Cen"],
  ["Cepheus", "Cep"],
  ["Cetus", "Cet"],
  ["Chamaeleon", "Cha"],
  ["Circinus", "Cir"],
  ["Columba", "Col"],
  ["Coma Berenices", "Com"],
  ["Corona Austrina", "CrA"],
  ["Corona Borealis", "CrB"],
  ["Corvus", "Crv"],
  ["Crater", "Crt"],
  ["Crux", "Cru"],
  ["Cygnus", "Cyg"],
  ["Delphinus", "Del"],
  ["Dorado", "Dor"],
  ["Draco", "Dra"],
  ["Equuleus", "Equ"],
  ["Eridanus", "Eri"],
  ["Fornax", "For"],
  ["Gemini", "Gem"],
  ["Grus", "Gru"],
  ["Hercules", "Her"],
  ["Horologium", "Hor"],
  ["Hydra", "Hya"],
  ["Hydrus", "Hyi"],
  ["Indus", "Ind"],
  ["Lacerta", "Lac"],
  ["Leo", "Leo"],
  ["Leo Minor", "LMi"],
  ["Lepus", "Lep"],
  ["Libra", "Lib"],
  ["Lupus", "Lup"],
  ["Lynx", "Lyn"],
  ["Lyra", "Lyr"],
  ["Mensa", "Men"],
  ["Microscopium", "Mic"],
  ["Monoceros", "Mon"],
  ["Musca", "Mus"],
  ["Norma", "Nor"],
  ["Octans", "Oct"],
  ["Ophiuchus", "Oph"],
  ["Orion", "Ori"],
  ["Pavo", "Pav"],
  ["Pegasus", "Peg"],
  ["Perseus", "Per"],
  ["Phoenix", "Phe"],
  ["Pictor", "Pic"],
  ["Pisces", "Psc"],
  ["Piscis Austrinus", "PsA"],
  ["Puppis", "Pup"],
  ["Pyxis", "Pyx"],
  ["Reticulum", "Ret"],
  ["Sagitta", "Sge"],
  ["Sagittarius", "Sgr"],
  ["Scorpius", "Sco"],
  ["Sculptor", "Scl"],
  ["Scutum", "Sct"],
  ["Serpens Caput", "Ser"],
  ["Serpens Cauda", "Ser"],
  ["Sextans", "Sex"],
  ["Taurus", "Tau"],
  ["Telescopium", "Tel"],
  ["Triangulum", "Tri"],
  ["Triangulum Australe", "TrA"],
  ["Tucana", "Tuc"],
  ["Ursa Major", "UMa"],
  ["Ursa Minor", "UMi"],
  ["Vela", "Vel"],
  ["Virgo", "Vir"],
  ["Volans", "Vol"],
  ["Vulpecula", "Vul"]
];

const SATELLITES: [RegExp, string, number][] = [
  [/\b(iss|international space station|space station)\b/, "ISS (ZARYA)", 25544],
  [/\b(tiangong|chinese space station|css)\b/, "Tiangong", 48274],
  [/\b(hubble|hst)\b/, "Hubble Space Telescope", 20580],
];

const IMAGERY_TARGETS: [RegExp, string][] = [
  [/\bmoon|lunar\b/, "moon"], [/\bmars\b/, "mars"], [/\bjupiter|juno\b/, "jupiter"], [/\bsaturn|cassini\b/, "saturn"], [/\btitan\b/, "titan"],
  [/\bmercury|messenger\b/, "mercury"], [/\bvenus|magellan\b/, "venus"], [/\buranus\b/, "uranus"], [/\bneptune|triton\b/, "neptune"],
  [/\bpluto|new horizons\b/, "pluto"], [/\beuropa\b/, "europa"], [/\benceladus\b/, "enceladus"], [/\bio\b/, "io"], [/\bganymede\b/, "ganymede"], [/\bcallisto\b/, "callisto"],
];

export function normalizeUtterance(raw: string): string {
  return raw.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(hey|ok|okay)\s+aetherra\s*/, "").replace(/^aetherra\s*/, "")
    .replace(/^(please\s+|can you\s+|could you\s+|will you\s+|i want to\s+|i would like to\s+|let's\s+|lets\s+)/, "").trim();
}

const unknown = (normalized: string): ParsedCommand => ({ intent: { kind: "unknown", suggestions: [...VOICE_SUGGESTIONS] }, confidence: 0.2, normalized });

export function parseCommand(raw: string): ParsedCommand {
  const t = normalizeUtterance(raw);
  if (!t) return unknown(t);
  const has = (re: RegExp) => re.test(t);

  if (has(/\b(help|what can you do|commands|examples)\b/)) return { intent: { kind: "help" }, confidence: 0.95, normalized: t };

  if (has(/\b(photos?|pictures?|images?|imagery|gallery)\b/) || has(/\brover\b/)) {
    for (const [re, target] of IMAGERY_TARGETS) {
      if (!re.test(t)) continue;
      if (target === "mars" && has(/rover|raw|perseverance|curiosity/)) {
        const rover = has(/curiosity/) ? "&rover=curiosity" : "";
        return { intent: { kind: "imagery", target, href: `/sky?gallery=mars&source=rover${rover}`, label: "Mars rover photos (raw)" }, confidence: 0.95, normalized: t };
      }
      const q = target === "jupiter" || has(/juno/) ? "&q=junocam" : "";
      const src = target === "mars" ? "&source=archive" : "";
      const label = target === "jupiter" ? "Jupiter: Juno / JunoCam imagery" : `${target[0].toUpperCase()}${target.slice(1)} imagery`;
      return { intent: { kind: "imagery", target, href: `/sky?gallery=${target}${src}${q}`, label }, confidence: 0.9, normalized: t };
    }
    if (has(/\brover\b/)) return { intent: { kind: "imagery", target: "mars", href: `/sky?gallery=mars&source=rover${has(/curiosity/) ? "&rover=curiosity" : ""}`, label: "Mars rover photos (raw)" }, confidence: 0.85, normalized: t };
  }

  if (has(/\bremind|reminder|notify me|alert me\b/)) {
    if (has(/\ball launches|every launch\b/)) return { intent: { kind: "remind-all" }, confidence: 0.9, normalized: t };
    return { intent: { kind: "remind-next" }, confidence: 0.9, normalized: t };
  }
  if (has(/\bnext launch|upcoming launch|when.*launch|launch.*when|countdown\b/)) return { intent: { kind: "next-launch" }, confidence: 0.95, normalized: t };
  if (has(/\btonight|visible.*(now|today|this evening)|what.*(up|visible|in the sky)\b/)) return { intent: { kind: "tonight" }, confidence: 0.9, normalized: t };

  const flightPlace = t.match(/\b(?:flights?|aircraft|planes?)\s+(?:near|over|around|above)\s+(.+)$/) || t.match(/\bwhat.*flying (?:over|near|above)\s+(.+)$/);
  if (flightPlace?.[1]) return { intent: { kind: "flights-near", place: flightPlace[1].replace(/\s+(please|now|today)$/, "").trim() }, confidence: 0.85, normalized: t };

  const layerMatch: [RegExp, "lines" | "labels" | "grid" | "daylightStars"][] = [
    [/constellation lines|constellations/, "lines"], [/labels?|names/, "labels"],
    [/grid|alt-az|coordinates grid/, "grid"], [/daylight stars|stars in daylight/, "daylightStars"],
  ];
  if (has(/\b(turn|switch|toggle|enable|disable|show|hide)\b/)) {
    for (const [re, layer] of layerMatch) {
      if (!re.test(t)) continue;
      return { intent: { kind: "layer", layer, on: !has(/\b(off|hide|disable|remove)\b/) }, confidence: 0.9, normalized: t };
    }
  }

  if (has(/\b(pause|freeze|stop)( time| the clock)?\b/) || t === "pause") return { intent: { kind: "time", action: "pause" }, confidence: 0.95, normalized: t };
  if (has(/\b(resume|play|unpause|continue)( time)?\b/) || t === "play") return { intent: { kind: "time", action: "play" }, confidence: 0.95, normalized: t };
  if (has(/\b(go live|real ?time|back to now|reset time)\b/)) return { intent: { kind: "time", action: "live" }, confidence: 0.9, normalized: t };
  if (has(/\bfaster|speed up|accelerate|time warp\b/)) return { intent: { kind: "time", action: "faster" }, confidence: 0.9, normalized: t };
  if (has(/\bslower|slow down|decelerate\b/)) return { intent: { kind: "time", action: "slower" }, confidence: 0.9, normalized: t };

  const findLike = has(/^(find|show|fly to|go to|where is|where's|locate|look at|open|view|see)\b/) || t.length <= 24;
  if (findLike) {
    for (const b of VOICE_BODIES) if (new RegExp(`\\b${b.toLowerCase()}\\b`).test(t)) return { intent: { kind: "find-body", body: b, href: `/sky?body=${b}` }, confidence: 0.95, normalized: t };
    for (const [name, id] of CONSTELLATIONS) if (t.includes(name.toLowerCase())) return { intent: { kind: "find-constellation", name, id, href: `/sky?con=${id}` }, confidence: 0.9, normalized: t };
    for (const [re, name, norad] of SATELLITES) if (re.test(t)) return { intent: { kind: "find-satellite", name, norad, href: `/orbit?sat=${norad}` }, confidence: 0.95, normalized: t };
  }

  if (has(/^(go to|open|show|view|take me to|navigate to|launch)\b/)) {
    for (const [re, view, href, label] of VIEWS) if (re.test(t)) return { intent: { kind: "navigate", view, href, label }, confidence: 0.9, normalized: t };
  }
  for (const [, view, href, label] of VIEWS) if (t === view) return { intent: { kind: "navigate", view, href, label }, confidence: 0.85, normalized: t };

  const fq = t.match(/^(?:find|fly to|go to|show me|show|where is|where's|locate|look at)\s+(.+)$/);
  if (fq?.[1]) return { intent: { kind: "find-query", query: fq[1].trim() }, confidence: 0.55, normalized: t };

  return unknown(t);
}

export function intentLabel(i: VoiceIntent): string {
  switch (i.kind) {
    case "navigate": return `Navigate to ${i.label}`;
    case "find-body": return `Find ${i.body} in the sky`;
    case "find-constellation": return `Find constellation ${i.name}`;
    case "find-satellite": return `Track ${i.name}`;
    case "find-query": return `Search for "${i.query}"`;
    case "imagery": return `Open imagery: ${i.label}`;
    case "next-launch": return "Next launch (Launch Library 2)";
    case "remind-next": return "Remind me about the next launch";
    case "remind-all": return "Remind me about all launches";
    case "flights-near": return `Flights near ${i.place}`;
    case "tonight": return "Tonight's sky summary";
    case "time": return `Time: ${i.action}`;
    case "layer": return `${i.on ? "Show" : "Hide"} sky layer: ${i.layer}`;
    case "help": return "Help / example commands";
    case "unknown": return "No matching command";
  }
}

export function formatCountdown(ms: number, spoken = false): string {
  const neg = ms < 0; const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (spoken) {
    const parts = [d && `${d} day${d > 1 ? "s" : ""}`, h && `${h} hour${h > 1 ? "s" : ""}`, m && `${m} minute${m > 1 ? "s" : ""}`, !d && !h && `${sec} second${sec !== 1 ? "s" : ""}`].filter(Boolean);
    return `${neg ? "minus " : ""}${parts.join(", ")}`;
  }
  return `${neg ? "T+" : "T-"}${d ? `${d}d ` : ""}${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}
