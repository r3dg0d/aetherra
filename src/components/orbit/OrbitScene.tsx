"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { Earth } from "@/components/globe/Earth";
import { Starfield } from "@/components/globe/Starfield";
import { SunMoon } from "@/components/globe/SunMoon";
import { CameraTelemetry } from "@/components/globe/CameraTelemetry";
import { useApp } from "@/lib/store/app";
import { latLonToVec3 } from "@/lib/astro/coords";

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

function FlyTo({ target }: { target: [number, number, number] | null }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => { if (target) goal.current = new THREE.Vector3(...target).normalize().multiplyScalar(Math.max(2.4, new THREE.Vector3(...target).length() * 1.9)); }, [target]);
  useFrame(() => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 0.06);
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null;
  });
  return null;
}

export default function OrbitScene({ data, selected, onPick, orbit, track, label, observer, flyTo }: {
  data: SatPoints | null; selected: number | null; onPick: (i: number) => void;
  orbit: [number, number, number][]; track: [number, number, number][][]; label: string | null; observer: { lat: number; lon: number } | null; flyTo: [number, number, number] | null;
}) {
  const quality = useApp((s) => s.quality);
  const selPos = selected != null && data ? ([data.pos[selected * 3], data.pos[selected * 3 + 1], data.pos[selected * 3 + 2]] as [number, number, number]) : null;
  return (
    <Canvas camera={{ position: [0, 1.5, 4.2], fov: 45, near: 0.005, far: 3000 }} dpr={quality === "low" ? 1 : [1, 2]} aria-label="3D view of tracked satellites around Earth">
      <color attach="background" args={["#030409"]} />
      <Suspense fallback={null}>
        <Starfield maxMag={5.5} lines={false} />
        <SunMoon />
        <Earth quality={quality} />
      </Suspense>
      <Sats data={data} selected={selected} onPick={onPick} />
      {orbit.length > 2 && <Line points={orbit} color="#A78BFA" lineWidth={1.2} transparent opacity={0.8} />}
      {track.map((seg, i) => seg.length > 1 && <Line key={i} points={seg} color="#42E2D0" lineWidth={1} transparent opacity={0.6} dashed={false} />)}
      {selPos && label && (
        <Html position={selPos} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className="mono whitespace-nowrap text-[10px] text-starlight" style={{ transform: "translate(10px,-18px)" }}>{label}</div>
        </Html>
      )}
      {observer && (
        <mesh position={latLonToVec3(observer.lat, observer.lon, 1.002)}><sphereGeometry args={[0.008, 8, 8]} /><meshBasicMaterial color="#FFB454" /></mesh>
      )}
      <FlyTo target={flyTo} />
      <OrbitControls enablePan={false} minDistance={1.1} maxDistance={60} enableDamping dampingFactor={0.07} rotateSpeed={0.5} />
      <CameraTelemetry />
    </Canvas>
  );
}
