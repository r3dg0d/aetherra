import { describe, it, expect } from "vitest";
import { geodeticToEcef, ecefToGeodetic, latLonToVec3, vec3ToLatLon, haversineKm, destinationPoint, stereographic, inverseStereographic, normalizeLon, formatRa } from "@/lib/astro/coords";

describe("coordinate transforms", () => {
  it("geodetic ↔ ECEF round-trips on WGS84", () => {
    for (const [lat, lon, h] of [[0, 0, 0], [28.5729, -80.649, 0.01], [-33.86, 151.21, 0.05], [89.9, 45, 400]]) {
      const e = geodeticToEcef(lat, lon, h);
      const g = ecefToGeodetic(e.x, e.y, e.z);
      expect(g.lat).toBeCloseTo(lat, 7);
      expect(g.lon).toBeCloseTo(lon, 7);
      expect(g.hKm).toBeCloseTo(h, 5);
    }
  });
  it("equatorial radius and polar radius match WGS84", () => {
    expect(geodeticToEcef(0, 0, 0).x).toBeCloseTo(6378.137, 6);
    expect(geodeticToEcef(90, 0, 0).z).toBeCloseTo(6356.752314, 4);
  });
  it("scene convention: +X Greenwich/equator, +Y north, −Z 90°E", () => {
    expect(latLonToVec3(0, 0)).toEqual([1, 0, -0]);
    const v = latLonToVec3(0, 90); expect(v[2]).toBeCloseTo(-1, 12);
    const n = latLonToVec3(90, 0); expect(n[1]).toBeCloseTo(1, 12);
    const back = vec3ToLatLon(...latLonToVec3(-41.3, 174.8));
    expect(back.lat).toBeCloseTo(-41.3, 10); expect(back.lon).toBeCloseTo(174.8, 10);
  });
  it("haversine: LAX–JFK ≈ 3974 km", () => {
    expect(haversineKm(33.9416, -118.4085, 40.6413, -73.7781)).toBeGreaterThan(3960);
    expect(haversineKm(33.9416, -118.4085, 40.6413, -73.7781)).toBeLessThan(3990);
  });
  it("destination point crosses antimeridian cleanly", () => {
    const p = destinationPoint(0, 179.9, 90, 111.2);
    expect(p.lon).toBeCloseTo(-179.1, 1);
  });
  it("stereographic projection: zenith at centre, horizon at r=1, inverse round-trips", () => {
    expect(stereographic(90, 0).r).toBeCloseTo(0, 12);
    expect(stereographic(0, 123).r).toBeCloseTo(1, 12);
    const p = stereographic(35, 250);
    const q = inverseStereographic(p.x, p.y);
    expect(q.alt).toBeCloseTo(35, 9); expect(q.az).toBeCloseTo(250, 9);
  });
  it("normalizeLon and RA formatting", () => {
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-540)).toBe(-180);
    expect(formatRa(101.287)).toBe("6h 45m 08.9s");
  });
});
