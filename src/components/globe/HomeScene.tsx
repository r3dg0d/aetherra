"use client";
import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Earth } from "./Earth";
import { Starfield } from "./Starfield";
import { SunMoon } from "./SunMoon";
import { IssMarker } from "./IssMarker";
import { CameraTelemetry } from "./CameraTelemetry";
import { useView } from "@/lib/store/app";
import { useQuality } from "@/lib/quality";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { SceneFx } from "@/components/three/SceneFx";
import { IntroOrbit } from "@/components/three/CameraRig";

export default function HomeScene({ intro = false, onIntroDone }: { intro?: boolean; onIntroDone?: () => void }) {
  const q = useQuality();
  const reduced = useReducedMotion();
  // Portrait phones need the camera further out to fit the globe.
  const home: [number, number, number] = typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8 ? [3.9, 2.0, 4.6] : [2.2, 1.1, 2.6];
  const onStatus = useCallback((s: string) => useView.getState().setData("LIVE", `Sky & Sun: ephemeris for now · ${s}`), []);
  return (
    <Canvas camera={{ position: intro ? [-14, 6.5, -26] : home, fov: 40, near: 0.005, far: 3000 }} dpr={q.dpr} gl={{ antialias: q.antialias && !q.bloom, powerPreference: "high-performance" }} aria-label="3D Earth with real-time day/night, stars and ISS">
      <color attach="background" args={["#030409"]} />
      <Suspense fallback={null}>
        <Starfield maxMag={q.starMag} milkyWay={q.milkyWay} />
        <SunMoon />
        <Earth />
        <IssMarker onStatus={onStatus} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={1.15} maxDistance={120} autoRotate={!reduced && !intro} autoRotateSpeed={0.25} enableDamping dampingFactor={0.06} rotateSpeed={0.5} zoomSpeed={0.6} />
      <IntroOrbit to={home} active={intro && !reduced} onDone={() => onIntroDone?.()} />
      <CameraTelemetry />
      <SceneFx />
    </Canvas>
  );
}
