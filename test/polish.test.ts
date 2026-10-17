import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { engineParams, beepHz, DRONES } from "@/lib/audio/params";
import { resolveTier, TIER_SETTINGS, TIERS } from "@/lib/quality";
import { arcPoint, easeInOutCubic } from "@/components/three/CameraRig";

describe("audio parameters", () => {
  it("engine is silent at zero throttle and loudest at full throttle in dense air", () => {
    expect(engineParams(0, 0, 1).gain).toBe(0);
    const sl = engineParams(1, 0, 1), vac = engineParams(1, 0, 0);
    expect(sl.gain).toBeGreaterThan(vac.gain);
    expect(vac.gain).toBeGreaterThan(0); // cinematic: still faintly audible in vacuum
  });
  it("dynamic pressure brightens the rumble and adds buffet", () => {
    const lo = engineParams(1, 0, 0.5), hi = engineParams(1, 35_000, 0.5);
    expect(hi.cutoff).toBeGreaterThan(lo.cutoff);
    expect(hi.buffet).toBeGreaterThan(lo.buffet);
  });
  it("clamps inputs", () => {
    const p = engineParams(5, 1e9, 9);
    expect(p.gain).toBeLessThanOrEqual(1);
    expect(p.buffet).toBeLessThanOrEqual(1);
  });
  it("final-three-second beeps are higher", () => { expect(beepHz(2)).toBeGreaterThan(beepHz(7)); });
  it("every scene has a drone", () => { for (const d of Object.values(DRONES)) expect(d.ratios.length).toBeGreaterThan(0); });
});

describe("quality presets", () => {
  it("auto resolves to the adaptive tier, explicit tiers pass through", () => {
    expect(resolveTier("auto", "low")).toBe("low");
    expect(resolveTier("ultra", "low")).toBe("ultra");
  });
  it("tiers are monotonic in cost", () => {
    for (let i = 1; i < TIERS.length; i++) {
      const a = TIER_SETTINGS[TIERS[i - 1]], b = TIER_SETTINGS[TIERS[i]];
      expect(b.dpr[1]).toBeGreaterThanOrEqual(a.dpr[1]);
      expect(b.particles).toBeGreaterThan(a.particles);
      expect(b.segments).toBeGreaterThan(a.segments);
    }
    expect(TIER_SETTINGS.low.bloom).toBe(false);
  });
});

describe("cinematic camera arc", () => {
  it("starts and ends exactly at the endpoints and pulls back mid-flight", () => {
    const a = new THREE.Vector3(3, 0, 0), b = new THREE.Vector3(0, 0, 3);
    expect(arcPoint(a, b, 0).distanceTo(a)).toBeLessThan(1e-9);
    expect(arcPoint(a, b, 1).distanceTo(b)).toBeLessThan(1e-9);
    expect(arcPoint(a, b, 0.5).length()).toBeGreaterThan(3);
  });
  it("easing is symmetric", () => { expect(easeInOutCubic(0.5)).toBeCloseTo(0.5); expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1); });
});
