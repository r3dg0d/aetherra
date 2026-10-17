"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app";

export function PerfPanel() {
  const show = useApp((s) => s.showPerf);
  const [fps, setFps] = useState(0);
  const [mem, setMem] = useState<number | null>(null);
  useEffect(() => {
    if (!show) return;
    let frames = 0, last = performance.now(), raf = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now;
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        setMem(m ? m.usedJSHeapSize / 1048576 : null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  return (
    <div className="glass mono fixed left-4 top-16 z-40 px-3 py-2 text-[11px]" aria-label="Performance">
      <div><span className="label mr-2">FPS</span>{fps}</div>
      {mem != null && <div><span className="label mr-2">HEAP</span>{mem.toFixed(0)} MB</div>}
      <div><span className="label mr-2">DPR</span>{typeof window !== "undefined" ? window.devicePixelRatio : 1}</div>
    </div>
  );
}
