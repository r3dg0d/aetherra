import * as sat from "satellite.js";

export type SatRec = sat.SatRec;
export type OmmLike = Parameters<typeof sat.json2satrec>[0];

export function satrecFromOmm(omm: OmmLike) {
  return sat.json2satrec(omm);
}
export function satrecFromTle(l1: string, l2: string) {
  return sat.twoline2satrec(l1, l2);
}

export interface SatPosition { lat: number; lon: number; altKm: number; eci: [number, number, number]; ecf: [number, number, number]; velKmS: number }

export function positionAt(rec: SatRec, date: Date): SatPosition | null {
  const pv = sat.propagate(rec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const p = pv.position, v = pv.velocity;
  if (!Number.isFinite(p.x)) return null;
  const gmst = sat.gstime(date);
  const g = sat.eciToGeodetic(p, gmst);
  const f = sat.eciToEcf(p, gmst);
  return { lat: sat.degreesLat(g.latitude), lon: sat.degreesLong(g.longitude), altKm: g.height, eci: [p.x, p.y, p.z], ecf: [f.x, f.y, f.z], velKmS: Math.hypot(v.x, v.y, v.z) };
}

/** Epoch of the element set as a JS Date. */
export function epochOf(rec: SatRec) {
  const yr = rec.epochyr < 57 ? 2000 + rec.epochyr : 1900 + rec.epochyr;
  return new Date(Date.UTC(yr, 0, 1) + (rec.epochdays - 1) * 86400_000);
}

/** Element set age classification: SGP4 accuracy degrades roughly 1–3 km/day for LEO. */
export function tleAge(rec: SatRec, now: Date) {
  const days = (now.getTime() - epochOf(rec).getTime()) / 86400_000;
  return { days, level: Math.abs(days) < 3 ? "fresh" : Math.abs(days) < 14 ? "aging" : "stale" } as const;
}

export function periodMinutes(rec: SatRec) {
  return (2 * Math.PI) / rec.no; // rec.no is rad/min
}

export function groundTrack(rec: SatRec, start: Date, minutes: number, stepS = 30) {
  const pts: { lat: number; lon: number; altKm: number; t: number }[] = [];
  for (let s = 0; s <= minutes * 60; s += stepS) {
    const d = new Date(start.getTime() + s * 1000);
    const p = positionAt(rec, d);
    if (p) pts.push({ lat: p.lat, lon: p.lon, altKm: p.altKm, t: d.getTime() });
  }
  return pts;
}

export interface Pass { rise: Date; culmination: Date; set: Date; maxElevationDeg: number; riseAzDeg: number; setAzDeg: number; visible: boolean | null }

/** Pass prediction for an observer by coarse scan (20 s) + bisection refinement of horizon crossings. */
export function predictPasses(rec: SatRec, obs: { lat: number; lon: number; heightM: number }, start: Date, hours = 48, minElevationDeg = 10, sunAltFn?: (d: Date) => number): Pass[] {
  const gd = { latitude: sat.degreesToRadians(obs.lat), longitude: sat.degreesToRadians(obs.lon), height: obs.heightM / 1000 };
  const look = (d: Date) => {
    const pv = sat.propagate(rec, d);
    if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
    const la = sat.ecfToLookAngles(gd, sat.eciToEcf(pv.position, sat.gstime(d)));
    return { el: sat.radiansToDegrees(la.elevation), az: sat.radiansToDegrees(la.azimuth) };
  };
  const refine = (a: number, b: number, rising: boolean) => {
    for (let i = 0; i < 20; i++) {
      const m = (a + b) / 2; const l = look(new Date(m));
      if (!l) break;
      if ((l.el > 0) === rising) b = m; else a = m;
    }
    return new Date((a + b) / 2);
  };
  const passes: Pass[] = [];
  const step = 20_000;
  let prev = look(start);
  let riseT: number | null = prev && prev.el > 0 ? start.getTime() : null;
  let max = { el: -90, t: 0 };
  for (let t = start.getTime() + step; t <= start.getTime() + hours * 3600_000; t += step) {
    const l = look(new Date(t));
    if (!l || !prev) { prev = l; continue; }
    if (prev.el <= 0 && l.el > 0) { riseT = refine(t - step, t, true).getTime(); max = { el: -90, t: 0 }; }
    if (riseT != null && l.el > max.el) max = { el: l.el, t };
    if (riseT != null && prev.el > 0 && l.el <= 0) {
      const setD = refine(t - step, t, false);
      if (max.el >= minElevationDeg) {
        const rl = look(new Date(riseT)), sl = look(setD);
        const sunAlt = sunAltFn ? sunAltFn(new Date(max.t)) : null;
        passes.push({ rise: new Date(riseT), culmination: new Date(max.t), set: setD, maxElevationDeg: max.el, riseAzDeg: rl?.az ?? 0, setAzDeg: sl?.az ?? 0, visible: sunAlt == null ? null : sunAlt < -6 });
      }
      riseT = null;
    }
    prev = l;
  }
  return passes;
}
