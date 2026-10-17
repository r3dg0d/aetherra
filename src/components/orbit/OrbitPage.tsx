"use client";
import { Sheet } from "@/components/shell/Sheet";
import { useAmbient } from "@/lib/audio/useAudio";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as sat from "@/lib/orbit/satellite";
import { satrecFromOmm, positionAt, epochOf, tleAge, periodMinutes, predictPasses, type SatRec } from "@/lib/orbit/sgp4";
import { ecefToScene, latLonToVec3, EARTH_RADIUS_KM } from "@/lib/astro/coords";
import { splitAtAntimeridian } from "@/lib/flights/interpolate";
import { bodyState } from "@/lib/astro/sky";
import { getSimDate, useTime, timeClass, simNow } from "@/lib/store/time";
import { useApp, useView } from "@/lib/store/app";
import { TimeControls } from "@/components/shell/TimeControls";
import { DataBadge } from "@/components/shell/DataBadge";
import type { SatPoints } from "./OrbitScene";

const OrbitScene = dynamic(() => import("./OrbitScene"), { ssr: false });

const GROUPS: { id: string; label: string; color: [number, number, number] }[] = [
  { id: "stations", label: "Space stations", color: [0.26, 0.89, 0.82] },
  { id: "gps-ops", label: "GPS", color: [0.32, 0.75, 1] },
  { id: "galileo", label: "Galileo", color: [0.45, 0.6, 1] },
  { id: "weather", label: "Weather", color: [1, 0.71, 0.33] },
  { id: "science", label: "Science", color: [0.65, 0.55, 0.98] },
  { id: "visual", label: "100 brightest", color: [0.96, 0.97, 1] },
  { id: "starlink", label: "Starlink (large)", color: [0.55, 0.55, 0.65] },
];

interface Omm { OBJECT_NAME: string; OBJECT_ID: string; NORAD_CAT_ID: number; EPOCH: string; INCLINATION: number; ECCENTRICITY: number; MEAN_MOTION: number; [k: string]: unknown }
interface Feed { group: string; fetchedAt: string | null; stale: boolean; dataClass: string; notice?: string; omms: Omm[] }

export default function OrbitPage() {
  useAmbient("orbit");
  const [active, setActive] = useState<string[]>(["stations", "gps-ops", "weather"]);
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [points, setPoints] = useState<SatPoints | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Only explicit user picks open the mobile sheet; the default ISS selection must not cover the globe.
  const [pickCount, setPickCount] = useState(0);
  const pick = useCallback((i: number) => { setSelected(i); setPickCount((n) => n + 1); }, []);
  const [query, setQuery] = useState("");
  const [flyTo, setFlyTo] = useState<[number, number, number] | null>(null);
  const worker = useRef<Worker | null>(null);
  const observer = useApp((s) => s.observer);
  const mode = useTime((s) => s.mode);

  // Load requested groups (server-cached CelesTrak GP data)
  useEffect(() => {
    for (const g of active) {
      if (feeds[g]) continue;
      fetch(`/api/satellites?group=${g}`).then((r) => r.json()).then((j) => setFeeds((f) => ({ ...f, [g]: { group: g, fetchedAt: j.fetchedAt, stale: j.stale, dataClass: j.dataClass, notice: j.notice, omms: j.data ?? [] } })));
    }
  }, [active, feeds]);

  const catalog = useMemo(() => {
    const seen = new Set<number>(); const list: { omm: Omm; group: string }[] = [];
    for (const g of active) for (const o of feeds[g]?.omms ?? []) if (!seen.has(o.NORAD_CAT_ID)) { seen.add(o.NORAD_CAT_ID); list.push({ omm: o, group: g }); }
    return list;
  }, [active, feeds]);
  const colors = useMemo(() => {
    const c = new Float32Array(catalog.length * 3);
    catalog.forEach((s, i) => c.set(GROUPS.find((g) => g.id === s.group)?.color ?? [1, 1, 1], i * 3));
    return c;
  }, [catalog]);

  // Worker: SGP4 for the whole catalog off the main thread
  useEffect(() => {
    const w = new Worker(new URL("../../workers/sgp4.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    return () => w.terminate();
  }, []);
  useEffect(() => {
    const w = worker.current; if (!w) return;
    w.postMessage({ type: "load", omms: catalog.map((c) => c.omm) });
    let id = 0, busy = false;
    w.onmessage = (e) => {
      if (e.data.type === "positions") { busy = false; setPoints({ pos: e.data.pos, colors, count: catalog.length }); }
    };
    const tick = () => { if (!busy) { busy = true; w.postMessage({ type: "tick", t: getSimDate().getTime(), id: ++id }); } };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [catalog, colors]);

  // Deep link ?sat=25544
  const wanted = useRef<number | null>(null);
  useEffect(() => { const s = new URLSearchParams(window.location.search).get("sat"); if (s) wanted.current = Number(s); else wanted.current = 25544; }, []);
  useEffect(() => {
    if (wanted.current == null) return;
    const i = catalog.findIndex((c) => c.omm.NORAD_CAT_ID === wanted.current);
    if (i >= 0) { setSelected(i); wanted.current = null; }
  }, [catalog]);

  const sel = selected != null ? catalog[selected] : null;
  const rec: SatRec | null = useMemo(() => (sel ? satrecFromOmm(sel.omm as unknown as Parameters<typeof satrecFromOmm>[0]) : null), [sel]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(simNow(useTime.getState())), 1000); return () => clearInterval(t); }, []);
  const pos = rec ? positionAt(rec, new Date(now)) : null;

  // Orbit ring (inertial ellipse in current Earth-fixed frame) + ground track (±1 orbit)
  const { orbit, track } = useMemo(() => {
    if (!rec) return { orbit: [], track: [] };
    const d = new Date(Math.floor(now / 30000) * 30000);
    const per = periodMinutes(rec), gmst = sat.gstime(d);
    const orbit: [number, number, number][] = [], gt: { lat: number; lon: number }[] = [];
    for (let m = 0; m <= per; m += per / 180) {
      const pv = sat.propagate(rec, new Date(d.getTime() + m * 60000));
      if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
      const f = sat.eciToEcf(pv.position, gmst);
      orbit.push(ecefToScene(f.x / EARTH_RADIUS_KM, f.y / EARTH_RADIUS_KM, f.z / EARTH_RADIUS_KM));
    }
    for (let m = -per / 2; m <= per; m += 1) { const p = positionAt(rec, new Date(d.getTime() + m * 60000)); if (p) gt.push({ lat: p.lat, lon: p.lon }); }
    const track = splitAtAntimeridian(gt).map((seg) => seg.map((p) => latLonToVec3(p.lat, p.lon, 1.003)));
    return { orbit, track };
  }, [rec, now]);

  const passBucket = Math.floor(now / 600000);
  const highOrbit = !pos || pos.altKm > 3000;
  const passes = useMemo(() => {
    if (!rec || highOrbit) return null;
    return predictPasses(rec, observer, new Date(passBucket * 600000), 48, 10, (d) => bodyState("Sun", d, observer).altDeg);
  }, [rec, observer, passBucket, highOrbit]);

  const feedStale = active.some((g) => feeds[g]?.stale);
  const unavailable = active.every((g) => feeds[g]?.dataClass === "UNAVAILABLE");
  useEffect(() => {
    const tc = timeClass(now, mode);
    useView.getState().setData(unavailable ? "UNAVAILABLE" : tc === "HISTORICAL" ? "HISTORICAL" : "PREDICTED", unavailable ? "CelesTrak unavailable" : `SGP4 propagation of CelesTrak GP elements${feedStale ? " (elements cache stale)" : ""}`);
  }, [now, mode, feedStale, unavailable]);

  const onPick = pick;
  const results = query.length > 1 ? catalog.map((c, i) => ({ c, i })).filter(({ c }) => c.omm.OBJECT_NAME.toLowerCase().includes(query.toLowerCase()) || String(c.omm.NORAD_CAT_ID) === query).slice(0, 8) : [];
  const age = rec ? tleAge(rec, new Date(now)) : null;
  const a = rec ? Math.cbrt(398600.4418 / (rec.no / 60) ** 2) : 0;

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0"><OrbitScene data={points} selected={selected} onPick={onPick} orbit={orbit} track={track} label={sel ? sel.omm.OBJECT_NAME : null} observer={observer} flyTo={flyTo} /></div>
      <Sheet title={sel ? sel.omm.OBJECT_NAME : "Satellites"} openSignal={pickCount} testId="orbit-sheet">
      <div className="absolute left-4 top-20 flex w-[280px] flex-col gap-2">
        <div className="glass p-3">
          <div className="label mb-2">Satellite groups · CelesTrak</div>
          {GROUPS.map((g) => (
            <label key={g.id} className="flex min-h-[30px] items-center justify-between py-0.5 text-[12px] pointer-coarse:min-h-[44px]">
              <span className="flex items-center gap-2"><input type="checkbox" data-testid={`orbit-group-${g.id}`} checked={active.includes(g.id)} onChange={(e) => setActive(e.target.checked ? [...active, g.id] : active.filter((x) => x !== g.id))} /><span className="h-2 w-2 rounded-full" style={{ background: `rgb(${g.color.map((c) => c * 255).join(",")})` }} />{g.label}</span>
              <span className="mono text-[10px] text-starlight/45">{feeds[g.id] ? (feeds[g.id].dataClass === "UNAVAILABLE" ? "n/a" : feeds[g.id].omms.length) : active.includes(g.id) ? "…" : ""}</span>
            </label>
          ))}
          <p className="mt-2 text-[10px] text-starlight/40">{catalog.length} objects · positions computed in a Web Worker (SGP4). Elements cached ≤2 h server-side per CelesTrak policy.</p>
        </div>
        <div className="glass p-3">
          <input className="input w-full" placeholder="Find satellite or NORAD ID" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find satellite" />
          <ul className="mt-1">{results.map(({ c, i }) => <li key={c.omm.NORAD_CAT_ID}><button className="w-full rounded px-2 py-1 text-left text-[12px] hover:bg-nebula/15" onClick={() => { pick(i); setQuery(""); }}>{c.omm.OBJECT_NAME} <span className="mono text-[10px] text-starlight/40">{c.omm.NORAD_CAT_ID}</span></button></li>)}</ul>
          <div className="mt-2 flex flex-wrap gap-1">{[["ISS", 25544], ["Tiangong", 48274], ["Hubble", 20580]].map(([n, id]) => <button key={id} className="btn" onClick={() => { const i = catalog.findIndex((c) => c.omm.NORAD_CAT_ID === id); if (i >= 0) pick(i); else if (id === 20580) setActive((a) => a.includes("science") ? a : [...a, "science"]); }}>{n}</button>)}</div>
        </div>
      </div>
      {sel && rec && (
        <aside className="glass fade-in absolute right-4 top-20 w-[310px] p-4" aria-label="Satellite details">
          <div className="flex items-start justify-between"><div><h2 className="text-[16px] font-medium">{sel.omm.OBJECT_NAME}</h2><p className="mono text-[11px] text-violet">NORAD {sel.omm.NORAD_CAT_ID} · {sel.omm.OBJECT_ID}</p></div><DataBadge value="PREDICTED" size="xs" /></div>
          {age && age.level !== "fresh" && <p className={`mt-2 rounded border px-2 py-1 text-[11px] ${age.level === "stale" ? "border-alert/50 text-alert" : "border-sim/50 text-sim"}`}>Element set is {age.days.toFixed(1)} days old — position error grows with age{age.level === "stale" ? " and may be many km" : ""}.</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            {pos ? (<>
              <dt className="text-starlight/50">Latitude</dt><dd className="mono text-right">{pos.lat.toFixed(3)}°</dd>
              <dt className="text-starlight/50">Longitude</dt><dd className="mono text-right">{pos.lon.toFixed(3)}°</dd>
              <dt className="text-starlight/50">Altitude</dt><dd className="mono text-right">{pos.altKm.toFixed(1)} km</dd>
              <dt className="text-starlight/50">Speed</dt><dd className="mono text-right">{pos.velKmS.toFixed(3)} km/s</dd>
            </>) : <><dt className="col-span-2 text-alert">Propagation failed (decayed or invalid elements)</dt></>}
            <dt className="text-starlight/50">Inclination</dt><dd className="mono text-right">{sel.omm.INCLINATION.toFixed(2)}°</dd>
            <dt className="text-starlight/50">Eccentricity</dt><dd className="mono text-right">{sel.omm.ECCENTRICITY.toFixed(5)}</dd>
            <dt className="text-starlight/50">Period</dt><dd className="mono text-right">{periodMinutes(rec).toFixed(1)} min</dd>
            <dt className="text-starlight/50">Perigee / apogee</dt><dd className="mono text-right">{(a * (1 - rec.ecco) - 6378.137).toFixed(0)} / {(a * (1 + rec.ecco) - 6378.137).toFixed(0)} km</dd>
            <dt className="text-starlight/50">TLE/OMM epoch</dt><dd className="mono text-right">{epochOf(rec).toISOString().slice(0, 16).replace("T", " ")}Z</dd>
          </dl>
          <div className="mt-2 flex gap-1"><button className="btn" onClick={() => pos && setFlyTo(ecefToScene(pos.ecf[0] / EARTH_RADIUS_KM, pos.ecf[1] / EARTH_RADIUS_KM, pos.ecf[2] / EARTH_RADIUS_KM))}>Fly to</button><button className="btn" onClick={() => setSelected(null)}>Close</button></div>
          {passes && (
            <div className="mt-3">
              <div className="label mb-1">Passes over {observer.name} (48 h, ≥10°)</div>
              {passes.length === 0 && <p className="text-[11px] text-starlight/50">No passes above 10° in the next 48 h.</p>}
              <ul className="scroll-thin max-h-40 space-y-1 overflow-y-auto text-[11px]">
                {passes.slice(0, 8).map((p) => (
                  <li key={p.rise.toISOString()} className="flex justify-between gap-2 border-b hairline pb-1">
                    <span className="mono">{p.rise.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="mono">max {p.maxElevationDeg.toFixed(0)}°</span>
                    <span className={p.visible ? "text-teal" : "text-starlight/40"} title="Observer in darkness (Sun below −6°). Satellite illumination is not modelled.">{p.visible ? "dark sky" : "daylight"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-[10px] text-starlight/40">Source: CelesTrak GP (18 SDS). Computed with SGP4 (satellite.js). Feed fetched {feeds[sel.group]?.fetchedAt ? new Date(feeds[sel.group].fetchedAt!).toLocaleTimeString() : "—"}.</p>
        </aside>
      )}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2"><TimeControls compact /></div>
      </Sheet>
    </div>
  );
}
