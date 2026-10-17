/**
 * Flight reconstruction renderer (data side).
 * Produces a GENERIC, SIMULATED ascent profile (gravity-turn shape) anchored to the real pad location and
 * published timeline events. It is never telemetry; every sample is labelled SIMULATED.
 */
export interface ReconSample { t: number; lat: number; lon: number; altKm: number; label?: string }

export function reconstructAscent(opts: { padLat: number; padLon: number; azimuthDeg?: number; durationS?: number; events?: { abbrev: string; relativeSeconds: number }[] }) {
  const az = ((opts.azimuthDeg ?? (Math.abs(opts.padLat) > 33 ? 180 : 90)) * Math.PI) / 180;
  const T = opts.durationS ?? 540;
  const R = 6371;
  const samples: ReconSample[] = [];
  const evs = (opts.events ?? []).filter((e) => e.relativeSeconds >= 0 && e.relativeSeconds <= T);
  for (let t = 0; t <= T; t += 5) {
    const f = t / T;
    const altKm = 200 * Math.pow(Math.sin((Math.PI / 2) * Math.min(1, f * 1.15)), 1.6);
    const downrangeKm = 1700 * Math.pow(f, 2.1);
    const d = downrangeKm / R;
    const lat1 = (opts.padLat * Math.PI) / 180, lon1 = (opts.padLon * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(az));
    const lon2 = lon1 + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    const ev = evs.find((e) => e.relativeSeconds >= t && e.relativeSeconds < t + 5);
    samples.push({ t, lat: (lat2 * 180) / Math.PI, lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180, altKm, label: ev?.abbrev });
  }
  return { classification: "SIMULATED" as const, note: "Generic gravity-turn reconstruction for visualization. Not measured telemetry.", samples };
}
