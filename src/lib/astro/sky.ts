import * as A from "astronomy-engine";
import { DEG, RAD, normalizeDeg } from "./coords";

export interface ObserverLoc { lat: number; lon: number; heightM: number; name: string }

export const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"] as const;
export type BodyName = (typeof BODIES)[number];

export interface BodyState {
  name: BodyName;
  raHours: number; decDeg: number; altDeg: number; azDeg: number;
  distanceAu: number; magnitude: number | null; phaseFraction: number | null; phaseAngle: number | null;
  constellation: string; elongationDeg: number | null;
}

const observerOf = (o: ObserverLoc) => new A.Observer(o.lat, o.lon, o.heightM);

/** Apparent topocentric position of a solar-system body (aberration, of-date equator, refraction "normal"). */
export function bodyState(name: BodyName, date: Date, obs: ObserverLoc): BodyState {
  const body = A.Body[name];
  const o = observerOf(obs);
  const eq = A.Equator(body, date, o, true, true);
  const hor = A.Horizon(date, o, eq.ra, eq.dec, "normal");
  let magnitude: number | null = null, phaseFraction: number | null = null, phaseAngle: number | null = null, elongationDeg: number | null = null;
  try {
    const ill = A.Illumination(body, date);
    magnitude = ill.mag; phaseFraction = ill.phase_fraction; phaseAngle = ill.phase_angle;
  } catch { /* not defined for some bodies */ }
  if (name !== "Sun") { try { elongationDeg = A.AngleFromSun(body, date); } catch {} }
  const eqj = A.Equator(body, date, o, false, true);
  return { name, raHours: eq.ra, decDeg: eq.dec, altDeg: hor.altitude, azDeg: hor.azimuth, distanceAu: eq.dist, magnitude, phaseFraction, phaseAngle, elongationDeg, constellation: A.Constellation(eqj.ra, eqj.dec).name };
}

export function allBodies(date: Date, obs: ObserverLoc) {
  return BODIES.map((b) => bodyState(b, date, obs));
}

/** Rise, transit and set within the next ~day. Null if the event does not occur (e.g. circumpolar). */
export function riseSet(name: BodyName, date: Date, obs: ObserverLoc) {
  const o = observerOf(obs);
  const body = A.Body[name];
  const start = new Date(date.getTime() - 12 * 3600_000);
  const rise = A.SearchRiseSet(body, o, +1, start, 2);
  const set = A.SearchRiseSet(body, o, -1, rise?.date ?? start, 2);
  const transit = A.SearchHourAngle(body, o, 0, start);
  return { rise: rise?.date ?? null, set: set?.date ?? null, transit: transit?.time.date ?? null, transitAltDeg: transit?.hor.altitude ?? null };
}

/** Rotation matrix EQJ (J2000 equator) → HOR for a time/observer; apply to many stars cheaply. */
export function eqjToHorMatrix(date: Date, obs: ObserverLoc) {
  return A.Rotation_EQJ_HOR(date, observerOf(obs)).rot;
}

/**
 * Convert a J2000 RA/Dec (deg) to alt/az using a precomputed EQJ→HOR matrix.
 * Astronomy Engine HOR frame: x = north, y = west, z = zenith.
 */
export function applyHor(rot: number[][], raDeg: number, decDeg: number) {
  const ra = raDeg * DEG, de = decDeg * DEG;
  const x = Math.cos(de) * Math.cos(ra), y = Math.cos(de) * Math.sin(ra), z = Math.sin(de);
  const hx = rot[0][0] * x + rot[1][0] * y + rot[2][0] * z;
  const hy = rot[0][1] * x + rot[1][1] * y + rot[2][1] * z;
  const hz = rot[0][2] * x + rot[1][2] * y + rot[2][2] * z;
  const alt = Math.asin(Math.max(-1, Math.min(1, hz))) * RAD;
  const az = normalizeDeg(Math.atan2(-hy, hx) * RAD);
  return { alt, az };
}

/** Greenwich apparent sidereal time in degrees. */
export function gastDeg(date: Date) {
  return A.SiderealTime(date) * 15;
}

/** Sub-solar point (where the Sun is at zenith), using apparent geocentric equatorial coordinates of date. */
export function subsolarPoint(date: Date) {
  const eq = A.Equator(A.Body.Sun, date, new A.Observer(0, 0, 0), true, true);
  const lon = ((eq.ra * 15 - gastDeg(date) + 540) % 360) - 180;
  return { lat: eq.dec, lon };
}

export function sublunarPoint(date: Date) {
  const v = A.GeoVector(A.Body.Moon, date, true);
  const eq = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(date), v));
  const lon = ((eq.ra * 15 - gastDeg(date) + 540) % 360) - 180;
  return { lat: eq.dec, lon, distKm: eq.dist * A.KM_PER_AU };
}

/** Twilight classification from solar altitude. */
export function skyCondition(sunAlt: number) {
  if (sunAlt > -0.833) return "Daylight";
  if (sunAlt > -6) return "Civil twilight";
  if (sunAlt > -12) return "Nautical twilight";
  if (sunAlt > -18) return "Astronomical twilight";
  return "Night";
}

export function moonPhaseName(date: Date) {
  const p = A.MoonPhase(date);
  const names = ["New Moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full Moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  return { angle: p, name: names[Math.round(p / 45) % 8] };
}

export function constellationAt(raDeg: number, decDeg: number) {
  return A.Constellation(raDeg / 15, decDeg).name;
}
