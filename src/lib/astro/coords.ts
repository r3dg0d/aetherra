export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const WGS84 = { a: 6378.137, f: 1 / 298.257223563 } as const;
export const EARTH_RADIUS_KM = 6371.0088;

export const normalizeLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
export const normalizeDeg = (d: number) => ((d % 360) + 360) % 360;

/**
 * Scene convention (three.js, Y-up, Earth-fixed): +X → (0°N, 0°E), +Y → North pole, −Z → (0°N, 90°E).
 * Matches THREE.SphereGeometry UV mapping of an equirectangular texture centred on Greenwich.
 */
export function latLonToVec3(latDeg: number, lonDeg: number, r = 1): [number, number, number] {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

export function vec3ToLatLon(x: number, y: number, z: number) {
  const r = Math.hypot(x, y, z);
  return { lat: Math.asin(y / r) * RAD, lon: Math.atan2(-z, x) * RAD, r };
}

/** ECEF (km, Z = north pole) → scene coordinates. */
export const ecefToScene = (x: number, y: number, z: number): [number, number, number] => [x, z, -y];

/** Geodetic (WGS84) → ECEF km. */
export function geodeticToEcef(latDeg: number, lonDeg: number, hKm = 0) {
  const { a, f } = WGS84;
  const e2 = f * (2 - f);
  const la = latDeg * DEG, lo = lonDeg * DEG;
  const N = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return { x: (N + hKm) * Math.cos(la) * Math.cos(lo), y: (N + hKm) * Math.cos(la) * Math.sin(lo), z: (N * (1 - e2) + hKm) * Math.sin(la) };
}

/** ECEF km → geodetic (Bowring iteration). */
export function ecefToGeodetic(x: number, y: number, z: number) {
  const { a, f } = WGS84;
  const e2 = f * (2 - f);
  const p = Math.hypot(x, y);
  const lon = Math.atan2(y, x);
  let lat = Math.atan2(z, p * (1 - e2));
  let h = 0;
  for (let i = 0; i < 6; i++) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - (e2 * N) / (N + h)));
  }
  return { lat: lat * RAD, lon: lon * RAD, hKm: h };
}

/** Great-circle distance (km) via haversine. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Destination point from start, bearing (deg from north) and distance (km) on a sphere. */
export function destinationPoint(latDeg: number, lonDeg: number, bearingDeg: number, distKm: number) {
  const d = distKm / EARTH_RADIUS_KM, b = bearingDeg * DEG, la = latDeg * DEG, lo = lonDeg * DEG;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * RAD, lon: normalizeLon(lo2 * RAD) };
}

/** Equatorial (RA hours or degrees, Dec deg) → unit vector in equatorial frame (Z = celestial pole). */
export function raDecToUnit(raDeg: number, decDeg: number): [number, number, number] {
  const ra = raDeg * DEG, de = decDeg * DEG;
  return [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)];
}

/** Horizontal: azimuth (deg, from north through east) / altitude → stereographic plane (zenith at centre, r=1 at horizon). */
export function stereographic(altDeg: number, azDeg: number, rotationDeg = 0) {
  const zen = (90 - altDeg) * DEG;
  const r = Math.tan(zen / 2); // r=1 at horizon
  const az = (azDeg - rotationDeg) * DEG;
  // North up, East left (looking up at the sky)
  return { x: -r * Math.sin(az), y: -r * Math.cos(az), r };
}

export function inverseStereographic(x: number, y: number, rotationDeg = 0) {
  const r = Math.hypot(x, y);
  const zen = 2 * Math.atan(r);
  const az = Math.atan2(-x, -y) * RAD + rotationDeg;
  return { alt: 90 - zen * RAD, az: normalizeDeg(az) };
}

export function formatLat(lat: number) { return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`; }
export function formatLon(lon: number) { return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`; }
export function formatRa(raDeg: number) {
  const h = normalizeDeg(raDeg) / 15; const hh = Math.floor(h); const m = (h - hh) * 60; const mm = Math.floor(m); const ss = (m - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m ${ss.toFixed(1).padStart(4, "0")}s`;
}
export function formatDec(dec: number) {
  const s = dec < 0 ? "−" : "+"; const a = Math.abs(dec); const d = Math.floor(a); const m = (a - d) * 60; const mm = Math.floor(m); const ss = (m - mm) * 60;
  return `${s}${d}° ${String(mm).padStart(2, "0")}′ ${ss.toFixed(0).padStart(2, "0")}″`;
}
