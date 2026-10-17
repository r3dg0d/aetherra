import { describe, it, expect } from "vitest";
import * as A from "astronomy-engine";
import { bodyState, subsolarPoint, eqjToHorMatrix, applyHor, riseSet, moonPhaseName, sublunarPoint } from "@/lib/astro/sky";
import { bvToTemperatureK } from "@/lib/astro/catalog";

const greenwich = { lat: 51.4769, lon: -0.0005, heightM: 46, name: "Greenwich" };

describe("solar and lunar positions vs references", () => {
  it("Sun at J2000.0 epoch: RA ≈ 18h45m, Dec ≈ −23.0° (Astronomical Almanac)", () => {
    const eq = A.Equator(A.Body.Sun, new Date("2000-01-01T12:00:00Z"), new A.Observer(0, 0, 0), true, true);
    expect(eq.ra).toBeGreaterThan(18.73); expect(eq.ra).toBeLessThan(18.77);
    expect(eq.dec).toBeCloseTo(-23.03, 1);
  });
  it("March equinox 2024-03-20 03:06 UTC: subsolar latitude ≈ 0°", () => {
    expect(Math.abs(subsolarPoint(new Date("2024-03-20T03:06:00Z")).lat)).toBeLessThan(0.01);
  });
  it("June solstice 2026-06-21 08:24 UTC: subsolar latitude ≈ +23.44°", () => {
    expect(subsolarPoint(new Date("2026-06-21T08:24:00Z")).lat).toBeCloseTo(23.44, 1);
  });
  it("Subsolar longitude near 0° at ~12:00 UTC (equation of time within ±4.5°)", () => {
    const p = subsolarPoint(new Date("2025-04-15T12:00:00Z"));
    expect(Math.abs(p.lon)).toBeLessThan(4.5);
  });
  it("Full Moon 2024-04-23 23:49 UTC: phase angle ≈ 180°", () => {
    expect(moonPhaseName(new Date("2024-04-23T23:49:00Z")).angle).toBeCloseTo(180, 0);
  });
  it("Moon distance stays within perigee/apogee bounds (356,000–407,000 km)", () => {
    for (let d = 0; d < 30; d += 3) {
      const m = sublunarPoint(new Date(Date.UTC(2026, 0, 1 + d)));
      expect(m.distKm).toBeGreaterThan(356_000); expect(m.distKm).toBeLessThan(407_000);
    }
  });
  it("Sun is below horizon at local midnight in Greenwich in winter", () => {
    const s = bodyState("Sun", new Date("2026-01-10T00:00:00Z"), greenwich);
    expect(s.altDeg).toBeLessThan(-50);
    expect(s.constellation).toBe("Sagittarius");
  });
  it("Sunrise in Greenwich on 2026-06-21 is ≈ 03:43 UTC", () => {
    const r = riseSet("Sun", new Date("2026-06-21T12:00:00Z"), greenwich);
    const mins = r.rise!.getUTCHours() * 60 + r.rise!.getUTCMinutes();
    expect(Math.abs(mins - (3 * 60 + 43))).toBeLessThanOrEqual(3);
  });
  it("matrix star transform agrees with Astronomy.Horizon (no refraction) for Sirius", () => {
    const date = new Date("2026-02-01T21:00:00Z");
    const ra = 101.287155, dec = -16.716116; // J2000
    const m = applyHor(eqjToHorMatrix(date, greenwich), ra, dec);
    const obs = new A.Observer(greenwich.lat, greenwich.lon, greenwich.heightM);
    const vec = A.VectorFromSphere(new A.Spherical(dec, ra, 1), A.MakeTime(date));
    const eqd = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(date), vec));
    const h = A.Horizon(date, obs, eqd.ra, eqd.dec);
    expect(m.alt).toBeCloseTo(h.altitude, 2);
    expect(m.az).toBeCloseTo(h.azimuth, 2);
  });
  it("B−V temperature: Sun (B−V 0.65) ≈ 5800 K", () => {
    expect(Math.abs(bvToTemperatureK(0.65)! - 5800)).toBeLessThan(200);
  });
});
