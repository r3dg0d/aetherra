"use client";
import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { Earth } from "@/components/globe/Earth";
import { Starfield } from "@/components/globe/Starfield";
import { SunMoon } from "@/components/globe/SunMoon";
import { CameraTelemetry } from "@/components/globe/CameraTelemetry";
import { latLonToVec3 } from "@/lib/astro/coords";
import { useQuality } from "@/lib/quality";
import { SceneFx } from "@/components/three/SceneFx";
import { CinematicFlyTo } from "@/components/three/CameraRig";
import { useReducedMotion } from "@/lib/useReducedMotion";

export interface SatPoints { pos: Float32Array; colors: Float32Array; count: number }

function Sats({ data, selected, onPick }: { data: SatPoints | null; selected: number | null; onPick: (i: number) => void }) {
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    if (!data) return;
    geo.setAttribute("position", new THREE.BufferAttribute(data.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    geo.computeBoundingSphere();
  }, [data, geo]);
  useEffect(() => { raycaster.params.Points = { threshold: 0.02 }; }, [raycaster]);
  const sel = selected != null && data ? new THREE.Vector3(data.pos[selected * 3], data.pos[selected * 3 + 1], data.pos[selected * 3 + 2]) : null;
  return (
    <>
      <points geometry={geo} onClick={(e) => { e.stopPropagation(); if (e.index != null) onPick(e.index); }} frustumCulled={false}>
        <pointsMaterial size={3.2} sizeAttenuation={false} vertexColors transparent opacity={0.95} depthWrite={false} />
      </points>
      {sel && (
        <mesh position={sel}><sphereGeometry args={[0.015, 12, 12]} /><meshBasicMaterial color="#F4F7FF" /></mesh>
      )}
    </>
  );
}

/**
 * Smoothed orbit ring with a comet-style fade: the samples start at the satellite's current position and run one
 * period ahead, so brightness ramps up toward the end of the array (just behind the satellite).
 */
function OrbitTrail({ points }: { points: [number, number, number][] }) {
  const { pts, colors } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const n = Math.min(1200, points.length * 4);
    const out = curve.getPoints(n);
    const a = new THREE.Color("#A78BFA"), b = new THREE.Color("#52BFFF");
    const cols = out.map((_, i) => { const f = i / n; const k = 0.12 + 0.88 * Math.pow(f, 1.6); return a.clone().lerp(b, f).multiplyScalar(k).toArray() as [number, number, number]; });
    return { pts: out, colors: cols };
  }, [points]);
  return <Line points={pts} vertexColors={colors} lineWidth={1.6} transparent opacity={0.95} toneMapped={false} />;
}

export default function OrbitScene({ data, selected, onPick, orbit, track, label, observer, flyTo }: {
  data: SatPoints | null; selected: number | null; onPick: (i: number) => void;
  orbit: [number, number, number][]; track: [number, number, number][][]; label: string | null; observer: { lat: number; lon: number } | null; flyTo: [number, number, number] | null;
}) {
  const q = useQuality();
  const reduced = useReducedMotion();
  const selPos = selected != null && data ? ([data.pos[selected * 3], data.pos[selected * 3 + 1], data.pos[selected * 3 + 2]] as [number, number, number]) : null;
  return (
    <Canvas camera={{ position: [0, 1.5, 4.2], fov: 45, near: 0.005, far: 3000 }} dpr={q.dpr} gl={{ antialias: q.antialias && !q.bloom }} aria-label="3D view of tracked satellites around Earth">
      <color attach="background" args={["#030409"]} />
      <Suspense fallback={null}>
        <Starfield maxMag={Math.min(q.starMag, 5.8)} lines={false} milkyWay={q.milkyWay} />
        <SunMoon />
        <Earth />
      </Suspense>
      <Sats data={data} selected={selected} onPick={onPick} />
      {orbit.length > 2 && <OrbitTrail points={orbit} />}
      {track.map((seg, i) => seg.length > 1 && <Line key={i} points={seg} color="#42E2D0" lineWidth={1} transparent opacity={0.6} dashed={false} />)}
      {selPos && label && (
        <Html position={selPos} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className="mono whitespace-nowrap text-[10px] text-starlight" style={{ transform: "translate(10px,-18px)" }}>{label}</div>
        </Html>
      )}
      {observer && (
        <mesh position={latLonToVec3(observer.lat, observer.lon, 1.002)}><sphereGeometry args={[0.008, 8, 8]} /><meshBasicMaterial color="#FFB454" /></mesh>
      )}
      <CinematicFlyTo target={flyTo} reduced={reduced} />
      <OrbitControls makeDefault enablePan={false} minDistance={1.1} maxDistance={60} enableDamping dampingFactor={0.07} rotateSpeed={0.5} />
      <CameraTelemetry />
      <SceneFx bloomIntensity={0.6} />
    </Canvas>
  );
}
