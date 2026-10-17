"use client";
import { useEffect, useRef } from "react";
import { MU, R_EARTH, vec, orbitalElements, type V3 } from "@/lib/ascent/physics";

interface SimLike { s: { r: V3; v: V3 }; history: V3[] }

/** Map view: trajectory history and the current Keplerian orbit, drawn in the instantaneous orbital plane. */
export function MapView({ sim }: { sim: SimLike }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { r, v } = sim.s;
    const hv = vec.cross(r, v);
    const e1 = vec.unit(r), n = vec.unit(hv), e2 = vec.cross(n, e1);
    const el = orbitalElements(r, v);
    const extent = Math.max(R_EARTH * 1.25, Number.isFinite(el.apoapsisAlt) ? Math.min(el.apoapsisAlt + R_EARTH, R_EARTH * 8) * 1.1 : R_EARTH * 3);
    const sc = (Math.min(W, H) * 0.45) / extent;
    const P = (p: V3) => [W / 2 + vec.dot(p, e1) * sc, H / 2 - vec.dot(p, e2) * sc] as const;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1a33"; ctx.strokeStyle = "#52BFFF"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R_EARTH * sc, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(66,226,208,0.25)"; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(W / 2, H / 2, (R_EARTH + 140_000) * sc, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // Predicted conic: r(θ) = p / (1 + e cos(θ − ω)), from the eccentricity vector
    const eVec = vec.sub(vec.mul(vec.cross(v, hv), 1 / MU), vec.unit(r));
    const e = vec.norm(eVec), p = vec.dot(hv, hv) / MU;
    const w = Math.atan2(vec.dot(eVec, e2), vec.dot(eVec, e1));
    ctx.strokeStyle = "#A78BFA"; ctx.lineWidth = 1.5; ctx.beginPath();
    let pen = false;
    for (let th = 0; th <= Math.PI * 2 + 0.01; th += 0.01) {
      const den = 1 + e * Math.cos(th - w); if (den <= 0.02) { pen = false; continue; }
      const rr = p / den; if (rr > extent * 1.5) { pen = false; continue; }
      const x = W / 2 + rr * Math.cos(th) * sc, y = H / 2 - rr * Math.sin(th) * sc;
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true;
    }
    ctx.stroke();
    ctx.strokeStyle = "#42E2D0"; ctx.lineWidth = 2; ctx.beginPath();
    sim.history.forEach((q, i) => { const [x, y] = P(q); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    const [x, y] = P(r); ctx.fillStyle = "#F4F7FF"; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(244,247,255,0.7)"; ctx.font = "11px monospace";
    ctx.fillText(`Ap ${Number.isFinite(el.apoapsisAlt) ? (el.apoapsisAlt / 1000).toFixed(0) : "∞"} km   Pe ${(el.periapsisAlt / 1000).toFixed(0)} km   e ${e.toFixed(3)}`, 20, H - 70);
    ctx.fillText("MAP VIEW · orbital plane · teal = flown path, violet = current orbit (Kepler), dashed = 140 km", 20, H - 52);
  }, [sim]);
  return <canvas ref={ref} className="h-full w-full" role="img" aria-label="Orbit map view" />;
}
