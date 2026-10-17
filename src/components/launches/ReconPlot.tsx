"use client";
import { useEffect, useRef } from "react";
import type { ReconSample } from "@/providers/launches/reconstruction";
import { haversineKm } from "@/lib/astro/coords";

/** Altitude vs downrange plot of the generic reconstruction. Always labelled SIMULATED. */
export function ReconPlot({ samples, progressS }: { samples: ReconSample[]; progressS: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pts = samples.map((s) => ({ x: haversineKm(samples[0].lat, samples[0].lon, s.lat, s.lon), y: s.altKm, t: s.t, label: s.label }));
    const mx = Math.max(...pts.map((p) => p.x), 1), my = Math.max(...pts.map((p) => p.y), 1);
    const X = (x: number) => 36 + (x / mx) * (W - 50), Y = (y: number) => H - 22 - (y / my) * (H - 40);
    ctx.strokeStyle = "rgba(167,139,250,0.2)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 10); ctx.lineTo(36, H - 22); ctx.lineTo(W - 10, H - 22); ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#FFB454"; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(244,247,255,0.55)"; ctx.font = "10px monospace";
    ctx.fillText(`${my.toFixed(0)} km`, 2, 14); ctx.fillText(`${mx.toFixed(0)} km downrange`, W - 120, H - 6);
    for (const p of pts) if (p.label) { ctx.fillStyle = "#A78BFA"; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3, 0, 7); ctx.fill(); ctx.fillText(p.label, X(p.x) + 5, Y(p.y) - 5); }
    if (progressS != null && progressS >= 0) { const p = pts.find((q) => q.t >= progressS) ?? pts[pts.length - 1]; ctx.fillStyle = "#F4F7FF"; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, 7); ctx.fill(); }
  }, [samples, progressS]);
  return <canvas ref={ref} className="h-44 w-full" role="img" aria-label="Simulated ascent profile, altitude versus downrange distance" />;
}
