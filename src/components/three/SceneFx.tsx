"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { TIERS, usePerf, useQuality, type Tier } from "@/lib/quality";

/**
 * Dynamic resolution + Auto quality. The canvas pixel ratio moves within the tier's DPR range as frame rate
 * rises or falls. In Auto mode, sustained low FPS at minimum resolution drops a tier (and good FPS at max raises it, capped at High).
 */
export function AdaptiveResolution() {
  const q = useQuality();
  const setDpr = useThree((s) => s.setDpr);
  const factor = useRef(0.75);
  const apply = (f: number) => {
    factor.current = f;
    const [lo, hi] = q.dpr;
    const dev = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const d = Math.min(dev * 1.25, lo + (hi - lo) * f);
    setDpr(Math.round(d * 100) / 100);
    usePerf.getState().setDpr(Math.round(d * 100) / 100);
  };
  // Re-apply when the tier changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => apply(factor.current), [q.tier]);
  const shift = (dir: 1 | -1) => {
    if (!q.auto) return;
    const i = TIERS.indexOf(q.tier) + dir;
    const max = TIERS.indexOf("high");
    if (i >= 0 && i <= max) usePerf.getState().setAutoTier(TIERS[i] as Tier);
  };
  return (
    <PerformanceMonitor
      bounds={(refresh) => (refresh > 90 ? [50, 90] : [40, 58])}
      flipflops={6}
      onChange={({ factor: f }) => apply(f)}
      onDecline={() => { if (factor.current <= 0.05) shift(-1); }}
      onIncline={() => { if (factor.current >= 0.95) shift(1); }}
      onFallback={() => { if (q.auto) usePerf.getState().setAutoTier("low"); }}
    />
  );
}

/** Publishes renderer stats (draw calls, triangles) to the perf store twice a second. */
export function RendererProbe() {
  const gl = useThree((s) => s.gl);
  const last = useRef(0);
  useFrame((st) => {
    if (st.clock.elapsedTime - last.current < 0.5) return;
    last.current = st.clock.elapsedTime;
    usePerf.getState().setStats({ calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  });
  return null;
}

/** Bloom for HDR-bright sources (Sun, bright stars, engine plume). Disabled on Low. */
export function Bloomfx({ intensity = 0.85, threshold = 1.0 }: { intensity?: number; threshold?: number }) {
  const q = useQuality();
  if (!q.bloom) return null;
  return (
    <EffectComposer multisampling={q.antialias ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={threshold} luminanceSmoothing={0.12} intensity={intensity * (q.tier === "ultra" ? 1.2 : 1)} radius={0.75} />
    </EffectComposer>
  );
}

/** Everything a 3D canvas needs for quality management. */
export function SceneFx({ bloom = true, bloomIntensity, bloomThreshold }: { bloom?: boolean; bloomIntensity?: number; bloomThreshold?: number }) {
  return (
    <>
      <AdaptiveResolution />
      <RendererProbe />
      {bloom && <Bloomfx intensity={bloomIntensity} threshold={bloomThreshold} />}
    </>
  );
}
