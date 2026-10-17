import { describe, it, expect } from "vitest";
import * as sat from "satellite.js";
import { satrecFromTle, epochOf, tleAge, positionAt, predictPasses, periodMinutes } from "@/lib/orbit/sgp4";

// Vallado et al. (2006) "Revisiting Spacetrack Report #3", verification case 00005 (TEME, km, km/s).
const L1 = "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753";
const L2 = "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667";

describe("SGP4 vs reference vectors", () => {
  const rec = satrecFromTle(L1, L2);
  it("t = 0 min", () => {
    const pv = sat.sgp4(rec, 0)!;
    const p = pv.position as sat.EciVec3<number>, v = pv.velocity as sat.EciVec3<number>;
    expect(p.x).toBeCloseTo(7022.46529266, 4); expect(p.y).toBeCloseTo(-1400.08296755, 4); expect(p.z).toBeCloseTo(0.03995155, 4);
    expect(v.x).toBeCloseTo(1.893841015, 6); expect(v.y).toBeCloseTo(6.405893759, 6); expect(v.z).toBeCloseTo(4.534807250, 6);
  });
  it("t = 360 min", () => {
    const pv = sat.sgp4(rec, 360)!;
    const p = pv.position as sat.EciVec3<number>;
    expect(p.x).toBeCloseTo(-7154.03120202, 3); expect(p.y).toBeCloseTo(-3783.17682504, 3); expect(p.z).toBeCloseTo(-3536.19412294, 3);
  });
  it("epoch decoding and staleness", () => {
    const e = epochOf(rec);
    expect(e.toISOString().slice(0, 10)).toBe("2000-06-27");
    expect(tleAge(rec, new Date("2000-06-28T00:00:00Z")).level).toBe("fresh");
    expect(tleAge(rec, new Date("2000-08-01T00:00:00Z")).level).toBe("stale");
  });
  it("ISS-like orbit: altitude, period, speed sane; passes found", () => {
    const iss = satrecFromTle(
      "1 25544U 98067A   24001.50000000  .00016717  00000-0  30035-3 0  9991",
      "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50057396432123",
    );
    const p = positionAt(iss, new Date("2024-01-01T13:00:00Z"))!;
    expect(p.altKm).toBeGreaterThan(380); expect(p.altKm).toBeLessThan(440);
    expect(p.velKmS).toBeCloseTo(7.66, 1);
    expect(periodMinutes(iss)).toBeCloseTo(92.9, 0);
    const passes = predictPasses(iss, { lat: 40.7, lon: -74, heightM: 10 }, new Date("2024-01-01T12:00:00Z"), 24, 10);
    expect(passes.length).toBeGreaterThan(0);
    for (const ps of passes) { expect(ps.set > ps.rise).toBe(true); expect(ps.maxElevationDeg).toBeGreaterThanOrEqual(10); expect(ps.maxElevationDeg).toBeLessThanOrEqual(90); }
  });
});
