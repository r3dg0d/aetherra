"use client";
import Link from "next/link";
import { useApp, type Quality } from "@/lib/store/app";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { quality, setQuality, reducedMotion, setReducedMotion, showPerf, togglePerf } = useApp();
  if (!open) return null;
  return (
    <div className="glass glass-strong fade-in fixed right-4 top-16 z-50 w-72 p-4" role="dialog" aria-label="Settings">
      <div className="mb-3 flex items-center justify-between"><span className="label">Settings</span><button onClick={onClose} aria-label="Close settings" className="text-starlight/60">✕</button></div>
      <fieldset className="mb-3">
        <legend className="mb-1 text-[12px]">Graphics quality</legend>
        <div className="flex gap-1">
          {(["low", "medium", "high"] as Quality[]).map((q) => (
            <button key={q} className={`btn flex-1 justify-center ${quality === q ? "btn-primary" : ""}`} onClick={() => setQuality(q)} aria-pressed={quality === q}>{q}</button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-starlight/45">Low: 2K textures, fewer stars, 1× pixel ratio. High: 4K textures, full catalog.</p>
      </fieldset>
      <label className="mb-2 flex items-center justify-between text-[12px]"><span>Reduce motion</span><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /></label>
      <label className="mb-3 flex items-center justify-between text-[12px]"><span>Performance panel</span><input type="checkbox" checked={showPerf} onChange={togglePerf} /></label>
      <Link href="/status" className="text-[12px] text-celestial" onClick={onClose}>Data sources, attribution & provider status →</Link>
    </div>
  );
}
