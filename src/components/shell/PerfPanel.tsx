"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app";
import { usePerf, resolveTier } from "@/lib/quality";

/** Developer performance panel: FPS, frame-time percentiles, draw calls, DPR and effective quality tier. */
export function PerfPanel() {
  const show = useApp((s) => s.showPerf);
  const quality = useApp((s) => s.quality);
  const { autoTier, dpr, calls, triangles } = usePerf();
  const [st, setSt] = useState({ fps: 0, p50: 0, p95: 0, mem: null as number | null });
  useEffect(() => {
    if (!show) return;
    let raf = 0, last = performance.now(), windowStart = last;
    const dts: number[] = [];
    const loop = () => {
      const now = performance.now();
      dts.push(now - last); last = now;
      if (now - windowStart >= 1000) {
        const sorted = [...dts].sort((a, b) => a - b);
        const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const fps = Math.round((dts.length * 1000) / (now - windowStart));
        setSt({ fps, p50: pct(0.5), p95: pct(0.95), mem: m ? m.usedJSHeapSize / 1048576 : null });
        usePerf.getState().setStats({ fps, frameMs: { p50: pct(0.5), p95: pct(0.95) } });
        dts.length = 0; windowStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  const tier = resolveTier(quality, autoTier);
  return (
    <div className="glass mono fixed left-3 z-40 grid grid-cols-[auto_auto] gap-x-3 px-3 py-2 text-[11px]" style={{ top: "calc(env(safe-area-inset-top) + 64px)" }} aria-label="Performance" data-testid="perf-panel">
      <span className="label">FPS</span><span className={st.fps < 30 ? "text-alert" : st.fps < 50 ? "text-sim" : "text-teal"}>{st.fps}</span>
      <span className="label">Frame p50/p95</span><span>{st.p50.toFixed(1)} / {st.p95.toFixed(1)} ms</span>
      <span className="label">Draw calls</span><span>{calls}</span>
      <span className="label">Triangles</span><span>{(triangles / 1000).toFixed(0)}k</span>
      <span className="label">DPR</span><span>{dpr.toFixed(2)}</span>
      <span className="label">Quality</span><span>{tier}{quality === "auto" ? " (auto)" : ""}</span>
      {st.mem != null && <><span className="label">Heap</span><span>{st.mem.toFixed(0)} MB</span></>}
    </div>
  );
}
