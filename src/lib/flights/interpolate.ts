import { destinationPoint, normalizeLon } from "../astro/coords";

export interface FlightState { icao24: string; lat: number; lon: number; altM: number | null; velocityMs: number | null; trackDeg: number | null; verticalRateMs: number | null; t: number /* unix s of position */ }

/** Dead-reckoning: project position forward along the great circle with the last known track and speed. Output is PREDICTED. */
export function extrapolate(s: FlightState, atUnixS: number, maxSeconds = 60) {
  const dt = Math.max(0, Math.min(maxSeconds, atUnixS - s.t));
  if (!s.velocityMs || s.trackDeg == null || dt === 0) return { lat: s.lat, lon: normalizeLon(s.lon), altM: s.altM, predictedSeconds: dt };
  const p = destinationPoint(s.lat, s.lon, s.trackDeg, (s.velocityMs * dt) / 1000);
  const altM = s.altM == null ? null : Math.max(0, s.altM + (s.verticalRateMs ?? 0) * dt);
  return { lat: p.lat, lon: p.lon, altM, predictedSeconds: dt };
}

/** Shortest signed longitude difference b−a in degrees (handles the antimeridian). */
export function lonDelta(a: number, b: number) {
  return normalizeLon(b - a);
}

/** Linear interpolation between two observed fixes that is safe across ±180°. */
export function interpolateFix(a: FlightState, b: FlightState, atUnixS: number) {
  const span = b.t - a.t;
  const f = span <= 0 ? 1 : Math.max(0, Math.min(1, (atUnixS - a.t) / span));
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: normalizeLon(a.lon + lonDelta(a.lon, b.lon) * f),
    altM: a.altM == null || b.altM == null ? (b.altM ?? a.altM) : a.altM + (b.altM - a.altM) * f,
  };
}

/** Split a polyline wherever it crosses the antimeridian so renderers don't draw a line across the globe. */
export function splitAtAntimeridian(points: { lat: number; lon: number }[]) {
  const segs: { lat: number; lon: number }[][] = [];
  let cur: { lat: number; lon: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i].lon - points[i - 1].lon) > 180) { segs.push(cur); cur = []; }
    cur.push(points[i]);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

/** Deterministic pseudo-random generator (mulberry32) for SIMULATED demo traffic. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SIMULATED demo aircraft: deterministic for a given seed and time; flagged so the UI labels them. */
export function simulatedTraffic(seed: number, center: { lat: number; lon: number }, count: number, atUnixS: number) {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const lat0 = center.lat + (rnd() - 0.5) * 16, lon0 = center.lon + (rnd() - 0.5) * 24;
    const track = rnd() * 360, v = 180 + rnd() * 80, alt = 3000 + Math.round(rnd() * 9000);
    const epoch = 1_700_000_000;
    const dt = (atUnixS - epoch) % 3600; // loop each hour
    const p = destinationPoint(lat0, lon0, track, (v * dt) / 1000 / 6);
    return { icao24: `sim${i.toString(16).padStart(3, "0")}`, callsign: `SIM${100 + i}`, lat: p.lat, lon: p.lon, altM: alt, velocityMs: v, trackDeg: track, verticalRateMs: 0, simulated: true as const };
  });
}
