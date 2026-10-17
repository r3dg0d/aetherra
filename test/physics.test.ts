import { describe, it, expect } from "vitest";
import { step, initialState, orbitalElements, isOrbitInserted, MU, R_EARTH, AETHER_1, density, totalMass, type SimState } from "@/lib/ascent/physics";

const circular = (altM: number): SimState => {
  const r = R_EARTH + altM;
  return { ...initialState(0, 0), r: [r, 0, 0], v: [0, Math.sqrt(MU / r), 0], landedOrCrashed: "flying", t: 100 };
};

describe("ASCENT physics", () => {
  it("conserves specific orbital energy over one orbit (RK4, gravity only)", () => {
    let s = circular(400_000);
    const e0 = orbitalElements(s.r, s.v).energy;
    const period = orbitalElements(s.r, s.v).periodS;
    const N = 5600; for (let i = 0; i < N; i++) s = step(s, period / N, AETHER_1, { gravity: true, drag: false, thrust: false });
    const e1 = orbitalElements(s.r, s.v).energy;
    expect(Math.abs((e1 - e0) / e0)).toBeLessThan(1e-8);
    expect(Math.hypot(s.r[0] - (R_EARTH + 400_000), s.r[1], s.r[2])).toBeLessThan(50); // closes after exactly one period
  });
  it("conserves angular momentum magnitude in an eccentric orbit", () => {
    const r = R_EARTH + 300_000;
    let s: SimState = { ...circular(300_000), v: [0, Math.sqrt(MU / r) * 1.1, 0] };
    const h0 = orbitalElements(s.r, s.v).h;
    for (let i = 0; i < 6000; i++) s = step(s, 1, AETHER_1, { gravity: true, drag: false, thrust: false });
    expect(Math.abs(orbitalElements(s.r, s.v).h - h0) / h0).toBeLessThan(1e-8);
  });
  it("apoapsis/periapsis from state vectors match analytic circular orbit", () => {
    const s = circular(500_000);
    const el = orbitalElements(s.r, s.v);
    expect(el.e).toBeLessThan(1e-10);
    expect(el.periapsisAlt).toBeCloseTo(500_000, 0);
    expect(el.apoapsisAlt).toBeCloseTo(500_000, 0);
    expect(isOrbitInserted(s.r, s.v)).toBe(true);
    expect(isOrbitInserted(circular(120_000).r, circular(120_000).v)).toBe(false);
  });
  it("exponential atmosphere", () => {
    expect(density(0)).toBeCloseTo(1.225, 6);
    expect(density(8500)).toBeCloseTo(1.225 / Math.E, 6);
    expect(density(200_000)).toBe(0);
  });
  it("vehicle lifts off at full throttle and burns propellant", () => {
    let s = { ...initialState(28.5, -80.6), engineOn: true, throttle: 1 };
    const m0 = totalMass(s, AETHER_1);
    for (let i = 0; i < 500; i++) s = step(s, 0.02, AETHER_1);
    expect(s.landedOrCrashed).toBe("flying");
    expect(totalMass(s, AETHER_1)).toBeLessThan(m0);
    expect(Math.hypot(...s.r) - R_EARTH).toBeGreaterThan(10);
  });
});
