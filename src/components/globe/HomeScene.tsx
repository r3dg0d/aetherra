"use client";
import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Earth } from "./Earth";
import { Starfield } from "./Starfield";
import { SunMoon } from "./SunMoon";
import { IssMarker } from "./IssMarker";
import { CameraTelemetry } from "./CameraTelemetry";
import { useApp, useView } from "@/lib/store/app";
import { useReducedMotion } from "@/components/shell/AppShell";

export default function HomeScene() {
  const quality = useApp((s) => s.quality);
  const reduced = useReducedMotion();
  const onStatus = useCallback((s: string) => useView.getState().setData("LIVE", `Sky & Sun: ephemeris for now · ${s}`), []);
  return (
    <Canvas camera={{ position: [2.2, 1.1, 2.6], fov: 40, near: 0.005, far: 3000 }} dpr={quality === "low" ? 1 : [1, 2]} gl={{ antialias: quality !== "low", powerPreference: "high-performance" }} aria-label="3D Earth with real-time day/night, stars and ISS">
      <color attach="background" args={["#030409"]} />
      <Suspense fallback={null}>
        <Starfield maxMag={quality === "low" ? 5 : 6} />
        <SunMoon />
        <Earth quality={quality} />
        <IssMarker onStatus={onStatus} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={1.15} maxDistance={120} autoRotate={!reduced} autoRotateSpeed={0.25} enableDamping dampingFactor={0.06} rotateSpeed={0.5} zoomSpeed={0.6} />
      <CameraTelemetry />
    </Canvas>
  );
}
