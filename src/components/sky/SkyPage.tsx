"use client";
import { Sheet } from "@/components/shell/Sheet";
import { useAmbient } from "@/lib/audio/useAudio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SkyCanvas, type SkyOptions, type SkySelection } from "./SkyCanvas";
import { InspectPanel } from "./InspectPanel";
import { TimeControls } from "@/components/shell/TimeControls";
import { ObserverPicker } from "@/components/shell/ObserverPicker";
import { useApp, useView } from "@/lib/store/app";
import { useSimNow } from "@/lib/useNow";
import { useTime, timeClass } from "@/lib/store/time";
import { allBodies, bodyState, moonPhaseName, skyCondition, applyHor, eqjToHorMatrix, BODIES, type BodyName } from "@/lib/astro/sky";
import { loadConstellations, loadStars } from "@/lib/astro/catalog";
import dynamic from "next/dynamic";
import type { GalleryInit } from "@/components/imagery/ImageryGallery";
import { bodyToTarget, targetById } from "@/providers/planetary-imagery/targets";

const ImageryGallery = dynamic(() => import("@/components/imagery/ImageryGallery").then((m) => m.ImageryGallery), { ssr: false });

export default function SkyPage() {
  useAmbient("sky");
  const observer = useApp((s) => s.observer);
  const sim = useSimNow(1000);
  const mode = useTime((s) => s.mode);
  const date = useMemo(() => new Date(sim), [sim]);
  const [sel, setSel] = useState<SkySelection>(null);
  const [focus, setFocus] = useState<{ az: number; alt: number } | null>(null);
  const [opt, setOpt] = useState<SkyOptions>({ lines: true, labels: true, grid: false, daylightStars: false, magLimit: 6 });
  const onSelect = useCallback((s: SkySelection) => setSel(s), []);
  const [gallery, setGallery] = useState<GalleryInit | null>(null);
  const openGallery = useCallback((g: GalleryInit) => {
    setGallery(g);
    const u = new URL(window.location.href); u.searchParams.set("gallery", g.target); window.history.replaceState(null, "", u);
  }, []);
  const closeGallery = useCallback(() => {
    setGallery(null);
    const u = new URL(window.location.href); ["gallery", "source", "rover", "q"].forEach((k) => u.searchParams.delete(k)); window.history.replaceState(null, "", u);
  }, []);
  useEffect(() => { useView.getState().setCamera(null); }, []);
  useEffect(() => { useView.getState().setData(timeClass(sim, mode), "Computed ephemeris (Astronomy Engine) for the selected time"); }, [sim, mode]);

  // Deep links: ?body=Mars | ?hip=32349 | ?con=Ori
  useEffect(() => {
    const apply = () => {
    const sp = new URLSearchParams(window.location.search);
    const body = sp.get("body") as BodyName | null, hip = sp.get("hip"), con = sp.get("con");
    // Voice layer toggles: ?layers=lines-off,labels-on
    const layers = sp.get("layers");
    if (layers) setOpt((o) => { const n = { ...o }; for (const part of layers.split(",")) { const [k, v] = part.split("-"); if (k in n && (v === "on" || v === "off")) (n as unknown as Record<string, boolean>)[k] = v === "on"; } return n; });
    // Imagery deep link: ?gallery=mars[&source=rover|archive][&rover=curiosity][&q=junocam]
    const g = sp.get("gallery");
    const gTarget = g === "1" && body ? bodyToTarget(body) : targetById(g)?.id;
    if (gTarget) {
      const src = sp.get("source"), rv = sp.get("rover"), q = sp.get("q");
      setGallery({ target: gTarget, source: src === "rover" || src === "archive" ? src : undefined, rover: rv === "curiosity" || rv === "perseverance" ? rv : undefined, q: q ?? undefined });
    }
    const d = new Date(), obs = useApp.getState().observer;
    if (body && (BODIES as readonly string[]).includes(body)) { const b = bodyState(body, d, obs); setSel({ kind: "body", name: body }); setFocus({ az: b.azDeg, alt: b.altDeg }); }
    if (hip) loadStars().then((c) => { const s = c.stars.find((x) => String(x[0]) === hip); if (s) { setSel({ kind: "star", star: s }); const h = applyHor(eqjToHorMatrix(d, obs), s[1], s[2]); setFocus({ az: h.az, alt: h.alt }); } });
    if (con) loadConstellations().then((c) => { const k = c.constellations.find((x) => x.id === con); if (k) { setSel({ kind: "constellation", con: k }); const h = applyHor(eqjToHorMatrix(d, obs), k.label[0], k.label[1]); setFocus({ az: h.az, alt: h.alt }); } });
    };
    apply();
    // Client-side navigation to /sky?… while already on /sky (e.g. from search) does not remount the page.
    window.addEventListener("aetherra:sky-params", apply);
    return () => window.removeEventListener("aetherra:sky-params", apply);
  }, []);

  const bodies = useMemo(() => allBodies(date, observer), [date, observer]);
  const sun = bodies[0];
  const moon = moonPhaseName(date);
  const visible = bodies.filter((b) => b.altDeg > 0 && b.name !== "Sun");
  return (
    <div className="relative h-full w-full bg-space">
      <SkyCanvas observer={observer} options={opt} selection={sel} onSelect={onSelect} focus={focus} />
      <Sheet title="Sky controls" openSignal={sel} testId="sky-sheet">
      <div className="pointer-events-none absolute left-4 top-20 flex flex-col gap-2">
        <div className="pointer-events-auto"><ObserverPicker /></div>
        <div className="glass pointer-events-auto w-[280px] px-3 py-2 text-[12px]">
          <div className="label mb-1">Conditions</div>
          <div className="flex justify-between"><span className="text-starlight/55">Sky</span><span>{skyCondition(sun.altDeg)}</span></div>
          <div className="flex justify-between"><span className="text-starlight/55">Sun altitude</span><span className="mono">{sun.altDeg.toFixed(1)}°</span></div>
          <div className="flex justify-between"><span className="text-starlight/55">Moon</span><span>{moon.name} ({(bodies[1].phaseFraction! * 100).toFixed(0)}%)</span></div>
          <div className="mt-1 text-starlight/55">Above horizon: <span className="text-starlight">{visible.map((b) => b.name).join(", ") || "none"}</span></div>
        </div>
        <div className="glass pointer-events-auto flex w-[280px] flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
          {([["lines", "Constellations"], ["labels", "Labels"], ["grid", "Alt-az grid"], ["daylightStars", "Stars in daylight"]] as const).map(([k, l]) => (
            <label key={k} className="flex min-h-[32px] items-center gap-1.5 pointer-coarse:min-h-[44px]"><input type="checkbox" checked={opt[k]} onChange={(e) => setOpt({ ...opt, [k]: e.target.checked })} data-testid={`sky-opt-${k}`} />{l}</label>
          ))}
          <label className="flex w-full items-center gap-2">Mag limit <input type="range" min={2} max={6} step={0.5} value={opt.magLimit} onChange={(e) => setOpt({ ...opt, magLimit: +e.target.value })} aria-label="Magnitude limit" /><span className="mono">{opt.magLimit}</span></label>
        </div>
      </div>
      <div className="absolute right-4 top-20">{sel && <InspectPanel sel={sel} date={date} obs={observer} onClose={() => setSel(null)} onImagery={(t) => openGallery({ target: t })} />}</div>
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2"><TimeControls /></div>
      </Sheet>
      {gallery && <ImageryGallery key={`${gallery.target}-${gallery.source}-${gallery.q}`} init={gallery} onClose={closeGallery} />}
    </div>
  );
}
