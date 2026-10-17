/**
 * ASCENT physics. Earth-centred inertial frame (metres, seconds). Fixed-timestep RK4 integration,
 * decoupled from rendering. Fictional vehicle; real physics (inverse-square gravity, exponential atmosphere).
 */
export const MU = 3.986004418e14; // m^3/s^2
export const R_EARTH = 6_371_000; // m (spherical model)
export const OMEGA_EARTH = 7.2921159e-5; // rad/s
export const G0 = 9.80665;
export const RHO0 = 1.225; // kg/m^3
export const SCALE_HEIGHT = 8500; // m
export const ORBIT_PERIAPSIS_MIN = 140_000; // m altitude

export type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
export const vec = { add, sub, mul, dot, cross, norm, unit };

export interface Stage { name: string; dryMass: number; propMass: number; thrustVac: number; thrustSl: number; ispVac: number; ispSl: number }
export interface Vehicle { name: string; stages: Stage[]; payloadMass: number; cd: number; areaM2: number }

/** "AETHER-1": original two-stage fictional launcher. Numbers are plausible, not a real vehicle. */
export const AETHER_1: Vehicle = {
  name: "AETHER-1",
  payloadMass: 4_000,
  cd: 0.3,
  areaM2: 10.5,
  stages: [
    { name: "Stage 1", dryMass: 22_000, propMass: 300_000, thrustSl: 5_900_000, thrustVac: 6_500_000, ispSl: 282, ispVac: 311 },
    { name: "Stage 2", dryMass: 4_000, propMass: 75_000, thrustSl: 700_000, thrustVac: 980_000, ispSl: 200, ispVac: 348 },
  ],
};

export interface SimState {
  t: number; r: V3; v: V3; stage: number; prop: number[]; throttle: number;
  pitchDeg: number; headingDeg: number; engineOn: boolean; landedOrCrashed: "pad" | "flying" | "crashed";
  maxQ: number; dynamicPressure: number; downrangeM: number; launchSite: { lat: number; lon: number };
}

export function initialState(latDeg = 28.5, lonDeg = -80.6, vehicle = AETHER_1): SimState {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  const r: V3 = [R_EARTH * Math.cos(la) * Math.cos(lo), R_EARTH * Math.cos(la) * Math.sin(lo), R_EARTH * Math.sin(la)];
  const v = cross([0, 0, OMEGA_EARTH], r); // co-rotating with the surface
  return { t: 0, r, v, stage: 0, prop: vehicle.stages.map((s) => s.propMass), throttle: 0, pitchDeg: 90, headingDeg: 90, engineOn: false, landedOrCrashed: "pad", maxQ: 0, dynamicPressure: 0, downrangeM: 0, launchSite: { lat: latDeg, lon: lonDeg } };
}

export function totalMass(s: SimState, veh: Vehicle) {
  let m = veh.payloadMass;
  for (let i = s.stage; i < veh.stages.length; i++) m += veh.stages[i].dryMass + s.prop[i];
  return m;
}

export const altitude = (r: V3) => norm(r) - R_EARTH;
export const density = (h: number) => (h < 0 ? RHO0 : h > 150_000 ? 0 : RHO0 * Math.exp(-h / SCALE_HEIGHT));

export function localFrame(r: V3) {
  const up = unit(r);
  let east = cross([0, 0, 1], up);
  if (norm(east) < 1e-9) east = [0, 1, 0];
  east = unit(east);
  const north = cross(up, east);
  return { up, east, north };
}

export function thrustDirection(r: V3, pitchDeg: number, headingDeg: number): V3 {
  const { up, east, north } = localFrame(r);
  const p = (pitchDeg * Math.PI) / 180, h = (headingDeg * Math.PI) / 180;
  const horiz = add(mul(north, Math.cos(h)), mul(east, Math.sin(h)));
  return unit(add(mul(horiz, Math.cos(p)), mul(up, Math.sin(p))));
}

export interface Forces { gravity: boolean; drag: boolean; thrust: boolean }

/** Acceleration and mass-flow for the current state. */
export function derivatives(s: SimState, r: V3, v: V3, veh: Vehicle, f: Forces = { gravity: true, drag: true, thrust: true }) {
  const m = totalMass(s, veh);
  let a: V3 = [0, 0, 0];
  const rn = norm(r);
  if (f.gravity) a = add(a, mul(r, -MU / (rn * rn * rn)));
  const h = rn - R_EARTH;
  const rho = density(h);
  const vAir = sub(v, cross([0, 0, OMEGA_EARTH], r));
  const vAirN = norm(vAir);
  const q = 0.5 * rho * vAirN * vAirN;
  if (f.drag && vAirN > 0) a = add(a, mul(unit(vAir), (-q * veh.cd * veh.areaM2) / m));
  let mdot = 0;
  const st = veh.stages[s.stage];
  if (f.thrust && s.engineOn && st && s.prop[s.stage] > 0 && s.throttle > 0) {
    const pFrac = Math.min(1, rho / RHO0);
    const thrust = (st.thrustVac + (st.thrustSl - st.thrustVac) * pFrac) * s.throttle;
    const isp = st.ispVac + (st.ispSl - st.ispVac) * pFrac;
    a = add(a, mul(thrustDirection(r, s.pitchDeg, s.headingDeg), thrust / m));
    mdot = thrust / (isp * G0);
  }
  return { a, mdot, q };
}

/** One fixed RK4 step (attitude/throttle held constant over the step). */
export function step(s: SimState, dt: number, veh: Vehicle = AETHER_1, f?: Forces): SimState {
  if (s.landedOrCrashed === "crashed") return s;
  const k1 = derivatives(s, s.r, s.v, veh, f);
  const r2 = add(s.r, mul(s.v, dt / 2)), v2 = add(s.v, mul(k1.a, dt / 2));
  const k2 = derivatives(s, r2, v2, veh, f);
  const r3 = add(s.r, mul(v2, dt / 2)), v3 = add(s.v, mul(k2.a, dt / 2));
  const k3 = derivatives(s, r3, v3, veh, f);
  const r4 = add(s.r, mul(v3, dt)), v4 = add(s.v, mul(k3.a, dt));
  const k4 = derivatives(s, r4, v4, veh, f);
  let r = add(s.r, mul(add(add(s.v, mul(add(v2, v3), 2)), v4), dt / 6));
  let v = add(s.v, mul(add(add(k1.a, mul(add(k2.a, k3.a), 2)), k4.a), dt / 6));
  const prop = [...s.prop];
  prop[s.stage] = Math.max(0, prop[s.stage] - k1.mdot * dt);
  let status: SimState["landedOrCrashed"] = s.landedOrCrashed;
  // Ground contact: on the pad before liftoff (thrust < weight) we stay put, co-rotating.
  if (altitude(r) <= 0) {
    if (status === "pad" || s.t < 5) {
      const surf = mul(unit(r), R_EARTH);
      r = surf; v = cross([0, 0, OMEGA_EARTH], surf); status = "pad";
    } else status = "crashed";
  } else if (status === "pad" && altitude(r) > 1) status = "flying";
  const engineOn = s.engineOn && prop[s.stage] > 0;
  const launchR = initialState(s.launchSite.lat, s.launchSite.lon).r;
  const ang = Math.acos(Math.max(-1, Math.min(1, dot(unit(r), unit(launchR)))));
  return { ...s, t: s.t + dt, r, v, prop, engineOn, landedOrCrashed: status, dynamicPressure: k1.q, maxQ: Math.max(s.maxQ, k1.q), downrangeM: ang * R_EARTH };
}

/** Orbital elements from state vectors. */
export function orbitalElements(r: V3, v: V3) {
  const rn = norm(r), vn = norm(v);
  const energy = (vn * vn) / 2 - MU / rn;
  const hVec = cross(r, v), h = norm(hVec);
  const eVec = sub(mul(cross(v, hVec), 1 / MU), unit(r));
  const e = norm(eVec);
  const a = energy < 0 ? -MU / (2 * energy) : Infinity;
  const rp = (h * h) / MU / (1 + e);
  const ra = e < 1 ? a * (1 + e) : Infinity;
  const inc = (Math.acos(Math.max(-1, Math.min(1, hVec[2] / (h || 1)))) * 180) / Math.PI;
  const period = Number.isFinite(a) ? 2 * Math.PI * Math.sqrt((a * a * a) / MU) : Infinity;
  return { energy, a, e, inclinationDeg: inc, periapsisAlt: rp - R_EARTH, apoapsisAlt: ra - R_EARTH, periodS: period, h };
}

export function isOrbitInserted(r: V3, v: V3) {
  const el = orbitalElements(r, v);
  return el.e < 1 && el.periapsisAlt > ORBIT_PERIAPSIS_MIN;
}

export function stageSeparate(s: SimState, veh: Vehicle = AETHER_1): SimState {
  if (s.stage >= veh.stages.length - 1) return s;
  return { ...s, stage: s.stage + 1 };
}

/** Advance by wall-clock `elapsed` seconds under `warp`, in fixed sub-steps. Returns new state + leftover accumulator. */
export function advance(s: SimState, accumulator: number, elapsed: number, warp: number, dt = 0.02, veh = AETHER_1) {
  // Physics warp is capped while thrusting or in the atmosphere for stability.
  const effWarp = s.engineOn || altitude(s.r) < 100_000 ? Math.min(warp, 4) : warp;
  let acc = accumulator + Math.min(elapsed, 0.25) * effWarp;
  const h = effWarp > 10 ? Math.min(1, dt * effWarp / 10) : dt;
  let st = s, n = 0;
  while (acc >= h && n < 4000) { st = step(st, h, veh); acc -= h; n++; }
  return { state: st, accumulator: acc, effWarp };
}
