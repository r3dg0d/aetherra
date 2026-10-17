import { describe, it, expect } from "vitest";
import { extrapolate, lonDelta, interpolateFix, splitAtAntimeridian, simulatedTraffic } from "@/lib/flights/interpolate";

describe("flight interpolation", () => {
  it("lonDelta takes the short way across ±180°", () => {
    expect(lonDelta(179, -179)).toBeCloseTo(2, 12);
    expect(lonDelta(-179, 179)).toBeCloseTo(-2, 12);
    expect(lonDelta(10, 20)).toBe(10);
  });
  it("interpolateFix midpoint across the antimeridian lands on ±180", () => {
    const a = { icao24: "x", lat: 10, lon: 179, altM: 10000, velocityMs: 250, trackDeg: 90, verticalRateMs: 0, t: 0 };
    const b = { ...a, lon: -179, lat: 12, altM: 11000, t: 100 };
    const m = interpolateFix(a, b, 50);
    expect(Math.abs(m.lon)).toBeCloseTo(180, 9);
    expect(m.lat).toBeCloseTo(11, 9);
    expect(m.altM).toBeCloseTo(10500, 9);
  });
  it("dead reckoning eastbound at the equator: 250 m/s × 60 s ≈ 0.1349°", () => {
    const p = extrapolate({ icao24: "x", lat: 0, lon: 0, altM: 10000, velocityMs: 250, trackDeg: 90, verticalRateMs: 5, t: 1000 }, 1060);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lon).toBeCloseTo(0.13490, 4);
    expect(p.altM).toBeCloseTo(10300, 6);
    expect(p.predictedSeconds).toBe(60);
  });
  it("prediction horizon is capped", () => {
    expect(extrapolate({ icao24: "x", lat: 0, lon: 0, altM: 0, velocityMs: 100, trackDeg: 0, verticalRateMs: 0, t: 0 }, 10_000, 60).predictedSeconds).toBe(60);
  });
  it("splitAtAntimeridian breaks lines that cross the dateline", () => {
    const s = splitAtAntimeridian([{ lat: 0, lon: 178 }, { lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 }, { lat: 0, lon: -178 }]);
    expect(s.length).toBe(2);
  });
  it("simulated traffic is deterministic for a seed/time and flagged", () => {
    const a = simulatedTraffic(42, { lat: 40, lon: -100 }, 5, 1_800_000_000);
    const b = simulatedTraffic(42, { lat: 40, lon: -100 }, 5, 1_800_000_000);
    expect(a).toEqual(b);
    expect(a.every((x) => x.simulated)).toBe(true);
  });
});
