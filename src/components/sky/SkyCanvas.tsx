"use client";
import { useEffect, useRef, useState } from "react";
import { loadConstellations, loadStars, bvToRgb, type Constellation, type StarRow } from "@/lib/astro/catalog";
import { allBodies, applyHor, eqjToHorMatrix, type BodyState, type ObserverLoc } from "@/lib/astro/sky";
import { stereographic, inverseStereographic } from "@/lib/astro/coords";
import { getSimDate } from "@/lib/store/time";
import { useView } from "@/lib/store/app";

export type SkySelection = { kind: "star"; star: StarRow } | { kind: "body"; name: BodyState["name"] } | { kind: "constellation"; con: Constellation } | null;

export interface SkyOptions { lines: boolean; labels: boolean; grid: boolean; daylightStars: boolean; magLimit: number }

const BODY_STYLE: Record<string, { color: string; r: number }> = {
  Sun: { color: "#FFE9A8", r: 9 }, Moon: { color: "#E8E6E0", r: 8 }, Mercury: { color: "#C9B8A6", r: 3.2 }, Venus: { color: "#FFF4D6", r: 4.5 },
  Mars: { color: "#FF8A5C", r: 3.8 }, Jupiter: { color: "#F2D9B0", r: 4.5 }, Saturn: { color: "#EAD49A", r: 4 }, Uranus: { color: "#A6E6F0", r: 2.8 }, Neptune: { color: "#7FA5FF", r: 2.6 },
};

/** Fisheye (stereographic) all-sky view: zenith at centre, horizon circle at the edge. North up, East left. */
export function SkyCanvas({ observer, options, selection, onSelect, focus }: { observer: ObserverLoc; options: SkyOptions; selection: SkySelection; onSelect: (s: SkySelection) => void; focus: { az: number; alt: number } | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stars, setStars] = useState<StarRow[]>([]);
  const [cons, setCons] = useState<Constellation[]>([]);
  const view = useRef({ rot: 0, zoom: 1, panX: 0, panY: 0 });
  const hit = useRef<{ x: number; y: number; sel: SkySelection }[]>([]);
  const props = useRef({ observer, options, selection });
  props.current = { observer, options, selection };

  useEffect(() => { loadStars().then((c) => setStars(c.stars)); loadConstellations().then((c) => setCons(c.constellations)); }, []);
  useEffect(() => {
    if (!focus) return;
    // Rotate so the focused object is "up" and zoom toward it.
    view.current.rot = focus.az;
    const p = stereographic(Math.max(focus.alt, -10), focus.az, focus.az);
    view.current.zoom = 1.8; view.current.panX = -p.x; view.current.panY = -p.y;
  }, [focus]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, lastT = 0;
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (ts - lastT < 33) return;
      lastT = ts;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { observer: obs, options: opt, selection: sel } = props.current;
      const v = view.current;
      const R = Math.min(W, H) * 0.44 * v.zoom;
      const cx = W / 2 + v.panX * R, cy = H / 2 + v.panY * R;
      const date = getSimDate();
      const bodies = allBodies(date, obs);
      const sun = bodies[0];
      const proj = (alt: number, az: number) => { const p = stereographic(alt, az, v.rot); return { x: cx + p.x * R, y: cy + p.y * R, r: p.r }; };
      // Sky colour from true solar altitude
      const sa = sun.altDeg;
      const dayF = Math.max(0, Math.min(1, (sa + 6) / 12));
      const twiF = Math.max(0, 1 - Math.abs(sa + 6) / 8);
      ctx.fillStyle = "#030409"; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(${8 + 60 * dayF},${15 + 110 * dayF},${32 + 170 * dayF},1)`);
      g.addColorStop(1, `rgba(${8 + 80 * dayF + 60 * twiF},${15 + 120 * dayF + 30 * twiF},${40 + 160 * dayF + 40 * twiF},1)`);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.clip();
      const starVis = opt.daylightStars ? 1 : Math.max(0, Math.min(1, (-sa - 2) / 10));
      const rot = eqjToHorMatrix(date, obs);
      const hits: typeof hit.current = [];
      // Grid
      if (opt.grid) {
        ctx.strokeStyle = "rgba(82,191,255,0.12)"; ctx.lineWidth = 0.7;
        for (const alt of [15, 30, 45, 60, 75]) { const r = stereographic(alt, 0).r * R; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        for (let az = 0; az < 360; az += 30) { const a = proj(0, az); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a.x, a.y); ctx.stroke(); }
      }
      // Constellation lines
      if (opt.lines && starVis > 0.05) {
        ctx.lineWidth = 0.8;
        for (const c of cons) {
          const selected = sel?.kind === "constellation" && sel.con.id === c.id;
          ctx.strokeStyle = selected ? "rgba(167,139,250,0.85)" : `rgba(121,86,255,${0.35 * starVis})`;
          ctx.beginPath();
          for (const seg of c.lines) {
            let pen = false;
            for (const [ra, dec] of seg) {
              const h = applyHor(rot, ra, dec);
              if (h.alt < -5) { pen = false; continue; }
              const p = proj(h.alt, h.az);
              if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
              pen = true;
            }
          }
          ctx.stroke();
          if (opt.labels) {
            const h = applyHor(rot, c.label[0], c.label[1]);
            if (h.alt > 3) { const p = proj(h.alt, h.az); ctx.fillStyle = selected ? "#A78BFA" : `rgba(167,139,250,${0.55 * starVis})`; ctx.font = "10px var(--font-sans), sans-serif"; ctx.textAlign = "center"; ctx.fillText(c.name.toUpperCase(), p.x, p.y); hits.push({ x: p.x, y: p.y, sel: { kind: "constellation", con: c } }); }
          }
        }
      }
      // Stars
      if (starVis > 0.02) {
        for (const s of stars) {
          if (s[3] > opt.magLimit) continue;
          const h = applyHor(rot, s[1], s[2]);
          if (h.alt < 0) continue;
          const p = proj(h.alt, h.az);
          if (p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) continue;
          const size = Math.max(0.5, (6.6 - s[3]) * 0.55) * Math.sqrt(v.zoom);
          const [r, gg, b] = bvToRgb(s[4]);
          ctx.fillStyle = `rgba(${(r * 255) | 0},${(gg * 255) | 0},${(b * 255) | 0},${Math.min(1, starVis * (0.35 + (6.5 - s[3]) / 6))})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
          if (s[3] < 4.5) hits.push({ x: p.x, y: p.y, sel: { kind: "star", star: s } });
          if (opt.labels && s[5] && s[3] < 1.8) { ctx.fillStyle = `rgba(244,247,255,${0.6 * starVis})`; ctx.font = "10px var(--font-sans), sans-serif"; ctx.textAlign = "left"; ctx.fillText(s[5], p.x + 5, p.y - 4); }
          if (sel?.kind === "star" && sel.star[0] === s[0]) { ctx.strokeStyle = "#52BFFF"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, size + 7, 0, Math.PI * 2); ctx.stroke(); }
        }
      }
      // Solar-system bodies
      for (const b of bodies) {
        if (b.altDeg < -1) continue;
        const p = proj(b.altDeg, b.azDeg);
        const st = BODY_STYLE[b.name];
        ctx.fillStyle = st.color; ctx.shadowColor = st.color; ctx.shadowBlur = b.name === "Sun" ? 30 : 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, st.r * Math.sqrt(v.zoom), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#F4F7FF"; ctx.font = "11px var(--font-sans), sans-serif"; ctx.textAlign = "left"; ctx.fillText(b.name, p.x + st.r + 5, p.y + 4);
        hits.push({ x: p.x, y: p.y, sel: { kind: "body", name: b.name } });
        if (sel?.kind === "body" && sel.name === b.name) { ctx.strokeStyle = "#52BFFF"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, st.r + 8, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
      // Horizon & cardinal points
      ctx.strokeStyle = "rgba(66,226,208,0.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "12px var(--font-mono), monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#42E2D0";
      for (const [lab, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270], ["NE", 45], ["SE", 135], ["SW", 225], ["NW", 315]] as const) {
        const p = stereographic(-6, az, v.rot);
        ctx.globalAlpha = lab.length === 1 ? 1 : 0.5;
        ctx.fillText(lab, cx + p.x * R, cy + p.y * R + 4);
      }
      ctx.globalAlpha = 1;
      hit.current = hits;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stars, cons]);

  // Interaction: drag rotates azimuth, wheel or two-finger pinch zooms, click/tap selects
  useEffect(() => {
    const cv = canvas.current!;
    let drag: { x: number; y: number; rot: number; moved: boolean } | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; zoom: number } | null = null;
    const pdist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cv.setPointerCapture(e.pointerId);
      if (pointers.size === 2) { pinch = { d: pdist(), zoom: view.current.zoom }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, rot: view.current.rot, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const v = view.current; v.zoom = Math.max(0.6, Math.min(12, pinch.zoom * (pdist() / Math.max(1, pinch.d))));
        if (v.zoom <= 1.05) { v.panX = 0; v.panY = 0; }
        return;
      }
      const rect = cv.getBoundingClientRect();
      const R = Math.min(rect.width, rect.height) * 0.44 * view.current.zoom;
      const x = (e.clientX - rect.left - rect.width / 2) / R - view.current.panX, y = (e.clientY - rect.top - rect.height / 2) / R - view.current.panY;
      if (Math.hypot(x, y) <= 1) {
        const h = inverseStereographic(x, y, view.current.rot);
        useView.getState().setCursor(null);
        cv.title = `Alt ${h.alt.toFixed(1)}°  Az ${h.az.toFixed(1)}°`;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      view.current.rot = drag.rot - dx * 0.3 / view.current.zoom;
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
      if (drag && !drag.moved) {
        const rect = cv.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        let best: SkySelection = null, bd = e.pointerType === "touch" ? 26 : 14;
        for (const h of hit.current) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.sel; } }
        onSelect(best);
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const v = view.current; v.zoom = Math.max(0.6, Math.min(12, v.zoom * Math.exp(-e.deltaY * 0.0012))); if (v.zoom <= 1.05) { v.panX = 0; v.panY = 0; } };
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") view.current.rot -= 5;
      if (e.key === "ArrowRight") view.current.rot += 5;
      if (e.key === "+" || e.key === "=") view.current.zoom = Math.min(12, view.current.zoom * 1.2);
      if (e.key === "-") view.current.zoom = Math.max(0.6, view.current.zoom / 1.2);
      if (e.key === "0") view.current = { rot: 0, zoom: 1, panX: 0, panY: 0 };
    };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("wheel", wheel, { passive: false }); window.addEventListener("keydown", key);
    return () => { cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.removeEventListener("wheel", wheel); window.removeEventListener("keydown", key); };
  }, [onSelect]);

  return <canvas ref={canvas} className="h-full w-full cursor-crosshair touch-none" role="img" aria-label="All-sky chart for the selected observer and time. Drag to rotate, scroll or pinch to zoom, click or tap an object to inspect. Arrow keys rotate, +/- zoom, 0 resets." />;
}
