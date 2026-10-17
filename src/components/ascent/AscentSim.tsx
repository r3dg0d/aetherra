"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Earth } from "@/components/globe/Earth";
import { Starfield } from "@/components/globe/Starfield";
import { Rocket } from "./Rocket";
import { Plume } from "./Plume";
import { MapView } from "./MapView";
import { TouchControls } from "./TouchControls";
import { useView } from "@/lib/store/app";
import { useQuality } from "@/lib/quality";
import { SceneFx } from "@/components/three/SceneFx";
import { Sheet } from "@/components/shell/Sheet";
import { audio } from "@/lib/audio/engine";
import { useAmbient } from "@/lib/audio/useAudio";
import { DataBadge } from "@/components/shell/DataBadge";
import {
  AETHER_1, OMEGA_EARTH, R_EARTH, advance, altitude, autopilot, initialState, isOrbitInserted, orbitalElements,
  stageSeparate, thrustDirection, totalMass, vec, G0, density, RHO0, type SimState,
} from "@/lib/ascent/physics";

const SITES = [{ name: "Florida coast (28.5°N)", lat: 28.5, lon: -80.6 }, { name: "Equatorial (Kourou-like, 5.2°N)", lat: 5.2, lon: -52.8 }, { name: "Polar-capable (34.6°N)", lat: 34.6, lon: -120.6 }];
const CAMS = ["chase", "wide", "ground", "orbital"] as const;
type Cam = (typeof CAMS)[number];
const SPACE = new THREE.Color("#030409");
const toScene = (v: [number, number, number]): [number, number, number] => [v[0] / 1000, v[2] / 1000, -v[1] / 1000];

interface Sim { s: SimState; acc: number; warp: number; paused: boolean; countdown: number | null; t0: number | null; assist: boolean; events: string[]; inserted: boolean; history: [number, number, number][] }

const met = (S: Sim) => (S.t0 == null ? 0 : S.s.t - S.t0).toFixed(0);

function freshSim(site = SITES[0]): Sim {
  return { s: initialState(site.lat, site.lon), acc: 0, warp: 1, paused: false, countdown: null, t0: null, assist: false, events: ["Vehicle on pad. Press SPACE to start the T−10 countdown."], inserted: false, history: [] };
}

function sunFor(p: THREE.Vector3): [number, number, number] {
  const u = p.clone().normalize(); const e = new THREE.Vector3(0, 1, 0).cross(u).normalize();
  return u.multiplyScalar(0.6).add(e.multiplyScalar(0.8)).toArray() as [number, number, number];
}

function World({ sim, cam, onHud }: { sim: React.RefObject<Sim>; cam: Cam; onHud: (s: Sim) => void }) {
  const earth = useRef<THREE.Group>(null);
  const rocket = useRef<THREE.Group>(null);
  const pad = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const q = useQuality();
  const scene = useThree((s) => s.scene);
  const starGroup = useRef<THREE.Group>(null);
  const skyCol = useMemo(() => new THREE.Color(), []);
  const lastBeep = useRef<number | null>(null);
  const lastHud = useRef(0);
  const adjusting = useRef(true);
  useEffect(() => { adjusting.current = true; }, [cam]);
  const [stage, setStage] = useState(0);
  const [thr, setThr] = useState(0);
  const [padLocal] = useState(() => new THREE.Vector3(...toScene(sim.current.s.r)));
  const sunDir = useMemo<[number, number, number]>(() => sunFor(padLocal), [padLocal]);

  useFrame((state, dt) => {
    const S = sim.current;
    // Countdown and fixed-timestep physics (decoupled from frame rate)
    if (!S.paused) {
      if (S.countdown != null) {
        S.countdown -= dt;
        if (S.countdown <= 0) { S.countdown = null; S.t0 = S.s.t; S.s = { ...S.s, engineOn: true, throttle: 1 }; S.events.unshift("T−0: ignition and liftoff."); }
      }
      if (S.s.landedOrCrashed !== "crashed") {
        const prevStage = S.s.stage;
        // Assist never ignites on the pad by itself: it takes over only after T−0.
        if (S.assist && S.t0 != null) S.s = autopilot(S.s);
        const r = advance(S.s, S.acc, dt, S.warp);
        S.s = r.state; S.acc = r.accumulator;
        if (S.s.stage !== prevStage) { S.events.unshift(`Stage separation at T+${met(S)} s.`); audio.thunk(); }
        if (S.s.landedOrCrashed === "crashed") S.events.unshift("Vehicle impacted the surface. Press R to reset.");
        if (!S.inserted && isOrbitInserted(S.s.r, S.s.v)) { S.inserted = true; S.events.unshift(`ORBIT ACHIEVED at T+${met(S)} s (periapsis > 140 km).`); }
        if (S.history.length === 0 || state.clock.elapsedTime - lastHud.current > 0.5) { S.history.push(S.s.r); if (S.history.length > 4000) S.history.shift(); }
      }
    }
    // Floating origin: the rocket is always at (0,0,0); everything else is placed relative to it (km).
    const rp = new THREE.Vector3(...toScene(S.s.r));
    if (earth.current) { earth.current.position.copy(rp).multiplyScalar(-1); earth.current.rotation.y = OMEGA_EARTH * S.s.t; }
    if (pad.current) { pad.current.position.copy(padLocal).applyAxisAngle(new THREE.Vector3(0, 1, 0), OMEGA_EARTH * S.s.t).sub(rp); pad.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), padLocal.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), OMEGA_EARTH * S.s.t)); }
    if (rocket.current) {
      const dir = new THREE.Vector3(...toScene(thrustDirection(S.s.r, S.s.pitchDeg, S.s.headingDeg).map((x) => x * 1000) as [number, number, number])).normalize();
      rocket.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    // Atmospheric colour shift: blue daytime sky near the ground fading to black space by ~80 km.
    const hKm = altitude(S.s.r) / 1000;
    const k = Math.min(1, Math.max(0, 1 - Math.exp(-Math.max(0, hKm) / 14)));
    skyCol.setRGB(0.36, 0.6, 0.9).lerp(SPACE, k);
    if (!(scene.background instanceof THREE.Color)) scene.background = skyCol.clone();
    else (scene.background as THREE.Color).copy(skyCol);
    if (starGroup.current) starGroup.current.visible = hKm > 22;
    // Audio: countdown beeps once per second, engine rumble from throttle/dynamic pressure/air density.
    if (S.countdown != null) {
      const sec = Math.ceil(S.countdown);
      if (lastBeep.current !== sec) { lastBeep.current = sec; if (sec <= 10 && sec >= 1) audio.beep(sec); }
    } else lastBeep.current = null;
    const firing = S.s.engineOn && S.s.prop[S.s.stage] > 0 && !S.paused;
    if (firing) audio.setEngine(S.s.throttle, S.s.dynamicPressure, Math.min(1, density(altitude(S.s.r)) / RHO0));
    else audio.stopEngine();
    // Camera modes
    const up = rp.clone().normalize();
    if (cam === "ground" && pad.current) {
      camera.position.copy(pad.current.position).add(up.clone().multiplyScalar(0.02)).add(new THREE.Vector3(0.4, 0, 0.3).projectOnPlane(up));
      camera.up.copy(up); camera.lookAt(0, 0, 0);
    } else if (controls.current) {
      controls.current.target.set(0, 0, 0);
      const want = cam === "chase" ? 0.18 : cam === "wide" ? 25 : 9000;
      const d = camera.position.length();
      if (adjusting.current) { if (Math.abs(d - want) / want > 0.02) camera.position.setLength(THREE.MathUtils.lerp(d, want, 0.15)); else adjusting.current = false; }
      camera.up.copy(up);
    }
    if (state.clock.elapsedTime - lastHud.current > 0.1) {
      lastHud.current = state.clock.elapsedTime;
      onHud(S);
      setStage(S.s.stage);
      setThr(S.s.engineOn && S.s.prop[S.s.stage] > 0 ? S.s.throttle : 0);
    }
  });
  useEffect(() => { camera.position.set(0.12, 0.05, 0.12); camera.up.copy(padLocal.clone().normalize()); }, [camera, padLocal]);
  useEffect(() => () => audio.stopEngine(), []);
  const plumeState = () => { const S = sim.current; const on = S.s.engineOn && S.s.prop[S.s.stage] > 0; return { throttle: on ? S.s.throttle : 0, density: Math.min(1, density(altitude(S.s.r)) / RHO0) }; };
  const padUp = padLocal.clone().normalize();
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={new THREE.Vector3(...sunDir).multiplyScalar(1000)} intensity={2.4} />
      <group ref={earth}>
        <Suspense fallback={null}><group scale={R_EARTH / 1000 - 0.6}><Earth fixedSunLocal={sunDir} segments={256} /></group></Suspense>
      </group>
      <group ref={pad}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0005, 0]}><circleGeometry args={[40, 64]} /><meshStandardMaterial color="#2b3a2e" roughness={1} /></mesh>
        <mesh position={[0, -0.0002, 0]}><cylinderGeometry args={[0.03, 0.03, 0.0006, 32]} /><meshStandardMaterial color="#5a5f6b" /></mesh>
        <mesh position={[0.009, 0.035, 0]}><boxGeometry args={[0.004, 0.07, 0.004]} /><meshStandardMaterial color="#7a3b2e" metalness={0.6} /></mesh>
        <mesh position={[0.005, 0.06, 0]}><boxGeometry args={[0.008, 0.001, 0.0015]} /><meshStandardMaterial color="#7a3b2e" /></mesh>
      </group>
      <group ref={rocket}>
        <Rocket stage={stage} thrust={thr} />
        <Plume count={q.particles} get={plumeState} />
      </group>
      <group ref={starGroup} position={padUp.clone().multiplyScalar(0)}><Starfield radius={150000} lines={false} maxMag={5.5} milkyWay={q.milkyWay} /></group>
      <OrbitControls ref={controls} enabled={cam !== "ground"} enablePan={false} minDistance={0.03} maxDistance={60000} enableDamping />
      <SceneFx bloomThreshold={1.0} bloomIntensity={0.9} />
    </>
  );
}

export default function AscentSim() {
  const sim = useRef<Sim>(freshSim());
  const [hud, setHud] = useState<Sim | null>(null);
  const [cam, setCam] = useState<Cam>("chase");
  const [map, setMap] = useState(false);
  const [site, setSite] = useState(SITES[0]);
  const keys = useRef(new Set<string>());
  useEffect(() => { useView.getState().setData("SIMULATED", "ASCENT: fictional vehicle, physics simulation"); useView.getState().setCamera(null); }, []);
  useAmbient("ascent");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const S = sim.current;
      keys.current.add(e.code);
      if (e.code === "Space") {
        e.preventDefault();
        if (S.s.landedOrCrashed === "pad" && !S.s.engineOn && S.countdown == null) { S.countdown = 10; S.events.unshift("Countdown started: T−10 s."); }
        else if (S.t0 != null) { const before = S.s.stage; S.s = stageSeparate(S.s); if (S.s.stage !== before) { S.s = { ...S.s, engineOn: S.s.prop[S.s.stage] > 0 }; S.events.unshift(`Manual staging at T+${met(S)} s.`); audio.thunk(); } }
      }
      if (e.code === "KeyR") { sim.current = freshSim(site); }
      if (e.code === "KeyC") { setCam((c) => CAMS[(CAMS.indexOf(c) + 1) % CAMS.length]); }
      if (e.code === "KeyM") setMap((m) => !m);
      if (e.code === "Escape") S.paused = !S.paused;
      if (e.code === "KeyP") S.assist = !S.assist;
      if (e.code === "Period") S.warp = Math.min(1000, S.warp * (S.warp < 4 ? 2 : 5));
      if (e.code === "Comma") S.warp = Math.max(1, S.warp / (S.warp <= 4 ? 2 : 5));
      if (e.code === "KeyX") S.s = { ...S.s, throttle: 0 };
      if (e.code === "KeyZ") S.s = { ...S.s, throttle: 1, engineOn: S.t0 != null && S.s.prop[S.s.stage] > 0 ? true : S.s.engineOn };
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    const t = setInterval(() => {
      const S = sim.current, k = keys.current;
      if (S.assist || S.paused) return;
      let { throttle, pitchDeg, headingDeg } = S.s;
      if (k.has("ShiftLeft") || k.has("ShiftRight")) throttle = Math.min(1, throttle + 0.02);
      if (k.has("ControlLeft") || k.has("ControlRight")) throttle = Math.max(0, throttle - 0.02);
      if (k.has("KeyW")) pitchDeg = Math.max(-30, pitchDeg - 0.5);
      if (k.has("KeyS")) pitchDeg = Math.min(90, pitchDeg + 0.5);
      if (k.has("KeyA")) headingDeg = (headingDeg - 0.5 + 360) % 360;
      if (k.has("KeyD")) headingDeg = (headingDeg + 0.5) % 360;
      const engineOn = S.s.engineOn || (throttle > 0 && S.t0 != null && S.s.prop[S.s.stage] > 0);
      S.s = { ...S.s, throttle, pitchDeg, headingDeg, engineOn };
    }, 20);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); clearInterval(t); };
  }, [site]);

  const s = hud?.s;
  const el = s ? orbitalElements(s.r, s.v) : null;
  const h = s ? altitude(s.r) : 0;
  const vSurf = s ? vec.norm(vec.sub(s.v, vec.cross([0, 0, OMEGA_EARTH], s.r))) : 0;
  const mass = s ? totalMass(s, AETHER_1) : 0;
  const st = s ? AETHER_1.stages[s.stage] : null;
  const pFrac = Math.min(1, density(h) / RHO0);
  const twr = s && st ? ((st.thrustVac + (st.thrustSl - st.thrustVac) * pFrac) * s.throttle) / (mass * G0) : 0;
  const km = (m: number) => (Number.isFinite(m) ? `${(m / 1000).toFixed(1)} km` : "∞");
  const S0 = () => sim.current;
  const actions = {
    launch: () => { const S = S0(); if (S.s.landedOrCrashed === "pad" && S.countdown == null && !S.s.engineOn) { S.countdown = 10; S.events.unshift("Countdown started: T−10 s."); } },
    stage: () => { const S = S0(); if (S.t0 == null) return; const before = S.s.stage; S.s = stageSeparate(S.s); if (S.s.stage !== before) { S.s = { ...S.s, engineOn: S.s.prop[S.s.stage] > 0 }; S.events.unshift(`Manual staging at T+${met(S)} s.`); audio.thunk(); } },
    throttle: (v: number) => { const S = S0(); S.s = { ...S.s, throttle: v, engineOn: S.t0 != null && v > 0 && S.s.prop[S.s.stage] > 0 ? true : S.s.engineOn }; },
    hold: (code: string, on: boolean) => { if (on) keys.current.add(code); else keys.current.delete(code); },
    assist: () => { S0().assist = !S0().assist; },
    warp: (dir: 1 | -1) => { const S = S0(); S.warp = dir > 0 ? Math.min(1000, S.warp * (S.warp < 4 ? 2 : 5)) : Math.max(1, S.warp / (S.warp <= 4 ? 2 : 5)); },
    cam: () => setCam((c) => CAMS[(CAMS.indexOf(c) + 1) % CAMS.length]),
    map: () => setMap((m) => !m),
    reset: () => { sim.current = freshSim(site); },
    pause: () => { S0().paused = !S0().paused; },
  };
  return (
    <div className="relative h-full w-full bg-space">
      <Canvas camera={{ fov: 50, near: 0.0005, far: 400000 }} gl={{ logarithmicDepthBuffer: true, antialias: false }} aria-label="ASCENT 3D flight view">
        <color attach="background" args={["#030409"]} />
        <World sim={sim} cam={cam} onHud={(x) => setHud({ ...x, events: [...x.events] })} key={site.name} />
      </Canvas>
      {map && hud && <div className="absolute inset-0 z-10 bg-space/80"><MapView sim={hud} /></div>}
      {/* Compact HUD strip (always visible, phone-friendly) */}
      <div className="ui-chrome pointer-events-none absolute inset-x-0 z-20 flex justify-center px-2 md:hidden" style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}>
        <div className="glass mono grid grid-cols-4 gap-x-3 px-3 py-1.5 text-[11px]" data-testid="ascent-hud-compact">
          <span className="label">MET</span><span className="label">ALT</span><span className="label">AP</span><span className="label">PE</span>
          <span>{hud?.t0 == null ? (hud?.countdown != null ? `T−${Math.ceil(hud.countdown)}` : "--") : `+${(hud.s.t - hud.t0).toFixed(0)}s`}</span>
          <span>{(h / 1000).toFixed(1)}</span><span>{el && Number.isFinite(el.apoapsisAlt) ? (el.apoapsisAlt / 1000).toFixed(0) : "—"}</span>
          <span className={el && el.periapsisAlt > 140000 ? "text-teal" : ""}>{el ? (el.periapsisAlt / 1000).toFixed(0) : "—"}</span>
        </div>
      </div>
      <Sheet title="Flight data" testId="ascent-sheet">
        <div className="absolute left-4 top-20 z-20 w-[270px] space-y-2">
          <div className="glass p-3 text-[12px]">
            <div className="mb-1 flex items-center justify-between"><span className="label">ASCENT · AETHER-1</span><DataBadge value="SIMULATED" size="xs" /></div>
            {hud?.countdown != null && <p className="mono text-[26px] text-sim">T−{Math.ceil(hud.countdown)}</p>}
            {hud && <p className="mono text-[13px]" data-testid="ascent-met">MET {hud.t0 == null ? "T−" + (hud.countdown != null ? Math.ceil(hud.countdown) : "--") : `T+${(hud.s.t - hud.t0).toFixed(1)}`} s</p>}
            <dl className="mono mt-1 grid grid-cols-2 gap-y-0.5 text-[11px]">
              <dt className="text-starlight/50">Altitude</dt><dd className="text-right" data-testid="ascent-alt">{km(h)}</dd>
              <dt className="text-starlight/50">Velocity (inertial)</dt><dd className="text-right">{s ? vec.norm(s.v).toFixed(0) : 0} m/s</dd>
              <dt className="text-starlight/50">Velocity (surface)</dt><dd className="text-right">{vSurf.toFixed(0)} m/s</dd>
              <dt className="text-starlight/50">Apoapsis</dt><dd className="text-right">{el ? km(el.apoapsisAlt) : "—"}</dd>
              <dt className="text-starlight/50">Periapsis</dt><dd className={`text-right ${el && el.periapsisAlt > 140000 ? "text-teal" : ""}`} data-testid="ascent-peri">{el ? km(el.periapsisAlt) : "—"}</dd>
              <dt className="text-starlight/50">Inclination</dt><dd className="text-right">{el ? el.inclinationDeg.toFixed(2) : "—"}°</dd>
              <dt className="text-starlight/50">Downrange</dt><dd className="text-right">{s ? km(s.downrangeM) : "—"}</dd>
              <dt className="text-starlight/50">Dyn. pressure</dt><dd className="text-right">{s ? (s.dynamicPressure / 1000).toFixed(1) : 0} kPa</dd>
              <dt className="text-starlight/50">Max-Q</dt><dd className="text-right">{s ? (s.maxQ / 1000).toFixed(1) : 0} kPa</dd>
            </dl>
          </div>
          <div className="glass p-3 text-[12px]">
            <dl className="mono grid grid-cols-2 gap-y-0.5 text-[11px]">
              <dt className="text-starlight/50">Stage</dt><dd className="text-right">{s ? `${s.stage + 1}/${AETHER_1.stages.length}` : "—"}</dd>
              <dt className="text-starlight/50">Throttle</dt><dd className="text-right">{s ? (s.throttle * 100).toFixed(0) : 0}%{s?.engineOn ? " 🔥" : ""}</dd>
              <dt className="text-starlight/50">Propellant</dt><dd className="text-right">{s && st ? ((s.prop[s.stage] / st.propMass) * 100).toFixed(1) : 0}%</dd>
              <dt className="text-starlight/50">Mass</dt><dd className="text-right">{(mass / 1000).toFixed(1)} t</dd>
              <dt className="text-starlight/50">TWR</dt><dd className="text-right">{twr.toFixed(2)}</dd>
              <dt className="text-starlight/50">Pitch / heading</dt><dd className="text-right">{s?.pitchDeg.toFixed(1)}° / {s?.headingDeg.toFixed(0)}°</dd>
              <dt className="text-starlight/50">Time warp</dt><dd className="text-right" data-testid="ascent-warp">×{hud?.warp ?? 1}</dd>
              <dt className="text-starlight/50">Camera</dt><dd className="text-right">{cam}</dd>
            </dl>
            <div className="mt-2 flex flex-wrap gap-1">
              <button className="btn" onClick={actions.launch}>Launch</button>
              <button className={`btn ${hud?.assist ? "btn-primary" : ""}`} onClick={actions.assist} aria-pressed={!!hud?.assist}>Assist (P)</button>
              <button className="btn" onClick={actions.map}>Map (M)</button>
              <button className="btn" onClick={actions.cam}>Camera (C)</button>
              <button className="btn" onClick={() => actions.warp(-1)} aria-label="Slower time warp">−warp</button>
              <button className="btn" onClick={() => actions.warp(1)} aria-label="Faster time warp" data-testid="warp-up">+warp</button>
              <button className="btn" onClick={actions.reset}>Reset (R)</button>
            </div>
            <label className="mt-2 block text-[11px]"><span className="label">Launch site</span>
              <select className="input mt-1 w-full" value={site.name} onChange={(e) => { const x = SITES.find((s) => s.name === e.target.value)!; setSite(x); sim.current = freshSim(x); }}>{SITES.map((s) => <option key={s.name}>{s.name}</option>)}</select></label>
          </div>
        </div>
        <div className="absolute right-4 top-20 z-20 w-[280px] space-y-2">
          {hud?.inserted && <div className="glass border-teal/50 p-3 text-center" data-testid="orbit-achieved"><p className="text-[11px] tracking-[0.3em] text-teal">ORBIT ACHIEVED</p><p className="mono text-[11px] text-starlight/60">{el && `${km(el.periapsisAlt)} × ${km(el.apoapsisAlt)} · ${(el.periodS / 60).toFixed(1)} min`}</p></div>}
          <div className="glass p-3 text-[11px]">
            <p className="label mb-1">Flight log</p>
            <ul className="scroll-thin max-h-40 space-y-0.5 overflow-y-auto" data-testid="flight-log">{hud?.events.slice(0, 12).map((e, i) => <li key={i} className={i === 0 ? "text-starlight" : "text-starlight/50"}>{e}</li>)}</ul>
            {hud?.paused && <p className="mt-1 text-sim">PAUSED (Esc)</p>}
          </div>
          <div className="glass p-3 text-[10px] leading-relaxed text-starlight/55">
            <p className="label mb-1">Controls</p>
            SPACE launch / stage · SHIFT/CTRL throttle ± · Z/X full/cut · W/S pitch ∓ · A/D heading · P assist · C camera · M map · , . time warp · R reset · Esc pause
            <p className="mt-1">Touch: on-screen throttle, attitude pad, STAGE and LAUNCH buttons.</p>
            <p className="mt-1">Inverse-square gravity, exponential atmosphere (H=8.5 km) with drag relative to the rotating air, Isp interpolated sea level→vacuum, RK4 at 50 Hz independent of frame rate. Orbit = periapsis above 140 km.</p>
            <p className="mt-1 text-starlight/45">Sound is cinematic: engine rumble follows throttle and dynamic pressure and fades as the air thins. It is not a model of real acoustics.</p>
          </div>
        </div>
      </Sheet>
      {hud?.inserted && <div className="ui-chrome pointer-events-none absolute inset-x-0 top-[120px] z-20 text-center md:hidden"><span className="glass px-3 py-1 text-[11px] tracking-[0.3em] text-teal">ORBIT ACHIEVED</span></div>}
      <TouchControls throttle={s?.throttle ?? 0} assist={!!hud?.assist} padReady={!!hud && hud.t0 == null && hud.countdown == null} actions={actions} />
    </div>
  );
}
