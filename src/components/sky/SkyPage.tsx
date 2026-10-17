"use client";
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

export default function SkyPage() {
  const observer = useApp((s) => s.observer);
  const sim = useSimNow(1000);
  const mode = useTime((s) => s.mode);
  const date = useMemo(() => new Date(sim), [sim]);
  const [sel, setSel] = useState<SkySelection>(null);
  const [focus, setFocus] = useState<{ az: number; alt: number } | null>(null);
  const [opt, setOpt] = useState<SkyOptions>({ lines: true, labels: true, grid: false, daylightStars: false, magLimit: 6 });
  const onSelect = useCallback((s: SkySelection) => setSel(s), []);
  useEffect(() => { useView.getState().setCamera(null); }, []);
  useEffect(() => { useView.getState().setData(timeClass(sim, mode), "Computed ephemeris (Astronomy Engine) for the selected time"); }, [sim, mode]);

  // Deep links: ?body=Mars | ?hip=32349 | ?con=Ori
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const body = sp.get("body") as BodyName | null, hip = sp.get("hip"), con = sp.get("con");
    const d = new Date(), obs = useApp.getState().observer;
    if (body && (BODIES as readonly string[]).includes(body)) { const b = bodyState(body, d, obs); setSel({ kind: "body", name: body }); setFocus({ az: b.azDeg, alt: b.altDeg }); }
    if (hip) loadStars().then((c) => { const s = c.stars.find((x) => String(x[0]) === hip); if (s) { setSel({ kind: "star", star: s }); const h = applyHor(eqjToHorMatrix(d, obs), s[1], s[2]); setFocus({ az: h.az, alt: h.alt }); } });
    if (con) loadConstellations().then((c) => { const k = c.constellations.find((x) => x.id === con); if (k) { setSel({ kind: "constellation", con: k }); const h = applyHor(eqjToHorMatrix(d, obs), k.label[0], k.label[1]); setFocus({ az: h.az, alt: h.alt }); } });
  }, []);

  const bodies = useMemo(() => allBodies(date, observer), [date, observer]);
  const sun = bodies[0];
  const moon = moonPhaseName(date);
  const visible = bodies.filter((b) => b.altDeg > 0 && b.name !== "Sun");
  return (
    <div className="relative h-full w-full bg-space">
      <SkyCanvas observer={observer} options={opt} selection={sel} onSelect={onSelect} focus={focus} />
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
            <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={opt[k]} onChange={(e) => setOpt({ ...opt, [k]: e.target.checked })} />{l}</label>
          ))}
          <label className="flex w-full items-center gap-2">Mag limit <input type="range" min={2} max={6} step={0.5} value={opt.magLimit} onChange={(e) => setOpt({ ...opt, magLimit: +e.target.value })} aria-label="Magnitude limit" /><span className="mono">{opt.magLimit}</span></label>
        </div>
      </div>
      <div className="absolute right-4 top-20">{sel && <InspectPanel sel={sel} date={date} obs={observer} onClose={() => setSel(null)} />}</div>
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2"><TimeControls /></div>
    </div>
  );
}
