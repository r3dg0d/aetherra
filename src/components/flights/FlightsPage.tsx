"use client";
import { useEffect, useRef, useState } from "react";
import type * as CesiumNS from "cesium";
import { useCesium, createViewer, osmLayer } from "@/components/cesium/useCesium";
import { extrapolate, type FlightState } from "@/lib/flights/interpolate";
import { useView } from "@/lib/store/app";
import { DataBadge } from "@/components/shell/DataBadge";
import type { DataClass } from "@/lib/classification";

interface Ac { icao24: string; callsign: string | null; originCountry?: string; lat: number; lon: number; baroAltitude?: number | null; geoAltitude?: number | null; altM?: number | null; velocity?: number | null; velocityMs?: number | null; trueTrack?: number | null; trackDeg?: number | null; verticalRate?: number | null; onGround?: boolean; timePosition?: number | null; lastContact?: number; squawk?: string | null; simulated?: boolean }
interface Track { state: FlightState; trail: { lat: number; lon: number; alt: number }[]; raw: Ac }

const PLANE = (color: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="${color}" d="M12 2c.6 0 1 .9 1 2v5l8 4.5v2l-8-2.5v4.5l2.5 2V21L12 20l-3.5 1v-1.5l2.5-2V13l-8 2.5v-2L11 9V4c0-1.1.4-2 1-2z"/></svg>`)}`;

export default function FlightsPage() {
  const { Cesium: C, error } = useCesium();
  const el = useRef<HTMLDivElement>(null);
  const v = useRef<CesiumNS.Viewer | null>(null);
  const tracks = useRef(new Map<string, Track>());
  const [demo, setDemo] = useState(false);
  const [meta, setMeta] = useState<{ dataClass: DataClass; notice?: string; count: number; fetchedAt?: string; auth?: string; swim?: { notice: string } } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!C || !el.current || v.current) return;
    const { viewer } = createViewer(C, el.current, { baseLayer: osmLayer(C) });
    v.current = viewer;
    viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(8.5, 48, 1.6e6) });
    const h = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    h.setInputAction((e: { position: CesiumNS.Cartesian2 }) => { const p = viewer.scene.pick(e.position); const id = p?.id?.id as string | undefined; setSel(id?.startsWith("ac:") ? id.slice(3) : null); }, C.ScreenSpaceEventType.LEFT_CLICK);
    const onCam = () => { const g = viewer.camera.positionCartographic; useView.getState().setCamera({ lat: C.Math.toDegrees(g.latitude), lon: C.Math.toDegrees(g.longitude), altKm: g.height / 1000, distanceKm: g.height / 1000 + 6371 }); };
    viewer.camera.changed.addEventListener(onCam); onCam();
    return () => { h.destroy(); viewer.destroy(); v.current = null; };
  }, [C]);

  // Poll the provider for the current view (bbox capped to protect the shared OpenSky quota)
  useEffect(() => {
    if (!C) return;
    tracks.current.clear();
    v.current?.entities.removeAll();
    const poll = async () => {
      const viewer = v.current; if (!viewer) return;
      const r = viewer.camera.computeViewRectangle();
      const g = viewer.camera.positionCartographic;
      const cLat = C.Math.toDegrees(g.latitude), cLon = C.Math.toDegrees(g.longitude);
      let b = r ? { lamin: C.Math.toDegrees(r.south), lomin: C.Math.toDegrees(r.west), lamax: C.Math.toDegrees(r.north), lomax: C.Math.toDegrees(r.east) } : { lamin: cLat - 5, lomin: cLon - 8, lamax: cLat + 5, lomax: cLon + 8 };
      if (b.lomax < b.lomin || (b.lamax - b.lamin) * (b.lomax - b.lomin) > 380) b = { lamin: Math.max(-89, cLat - 8), lomin: Math.max(-180, cLon - 11), lamax: Math.min(89, cLat + 8), lomax: Math.min(180, cLon + 11) };
      const q = new URLSearchParams({ lamin: b.lamin.toFixed(2), lomin: b.lomin.toFixed(2), lamax: b.lamax.toFixed(2), lomax: b.lomax.toFixed(2), ...(demo ? { mode: "demo" } : {}) });
      try {
        const j = await fetch(`/api/flights?${q}`).then((r) => r.json());
        const states: Ac[] = j.data?.states ?? [];
        const t = j.data?.time ?? Date.now() / 1000;
        const seen = new Set<string>();
        for (const a of states) {
          seen.add(a.icao24);
          const st: FlightState = { icao24: a.icao24, lat: a.lat, lon: a.lon, altM: a.geoAltitude ?? a.baroAltitude ?? a.altM ?? null, velocityMs: a.velocity ?? a.velocityMs ?? null, trackDeg: a.trueTrack ?? a.trackDeg ?? null, verticalRateMs: a.verticalRate ?? 0, t: a.timePosition ?? t };
          const prev = tracks.current.get(a.icao24);
          const trail = prev ? [...prev.trail, { lat: a.lat, lon: a.lon, alt: st.altM ?? 0 }].slice(-40) : [{ lat: a.lat, lon: a.lon, alt: st.altM ?? 0 }];
          tracks.current.set(a.icao24, { state: st, trail, raw: a });
        }
        for (const k of [...tracks.current.keys()]) if (!seen.has(k)) { tracks.current.delete(k); v.current?.entities.removeById(`ac:${k}`); v.current?.entities.removeById(`trail:${k}`); v.current?.entities.removeById(`pred:${k}`); }
        setMeta({ dataClass: j.dataClass, notice: j.notice, count: states.length, fetchedAt: j.fetchedAt, auth: j.auth, swim: j.swim });
        useView.getState().setData(j.dataClass, j.notice ?? `${j.attribution ?? ""}${j.ageSeconds != null ? ` · ${j.ageSeconds}s old` : ""}`);
      } catch { setMeta({ dataClass: "UNAVAILABLE", notice: "Flight API unreachable", count: 0 }); useView.getState().setData("UNAVAILABLE", "Flight API unreachable"); }
    };
    poll();
    const t = setInterval(poll, demo ? 5000 : 15000);
    return () => clearInterval(t);
  }, [C, demo]);

  // Render loop: dead-reckon between fixes (PREDICTED), observed trail solid, prediction dashed
  useEffect(() => {
    if (!C) return;
    const t = setInterval(() => {
      const viewer = v.current; if (!viewer) return;
      const now = Date.now() / 1000;
      for (const [k, tr] of tracks.current) {
        const p = extrapolate(tr.state, now, 90);
        const pos = C.Cartesian3.fromDegrees(p.lon, p.lat, p.altM ?? 0);
        const color = demo ? "#FFB454" : tr.raw.onGround ? "#8892a8" : "#52BFFF";
        let e = viewer.entities.getById(`ac:${k}`);
        if (!e) {
          e = viewer.entities.add({ id: `ac:${k}`, position: pos, billboard: { image: PLANE(color), width: 20, height: 20, alignedAxis: C.Cartesian3.UNIT_Z, scaleByDistance: new C.NearFarScalar(1e4, 1.4, 5e6, 0.5) } });
          viewer.entities.add({ id: `trail:${k}`, polyline: { positions: [], width: 1.5, material: C.Color.fromCssColorString("#42E2D0").withAlpha(0.7) } });
          viewer.entities.add({ id: `pred:${k}`, polyline: { positions: [], width: 1.2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#F4F7FF").withAlpha(0.6), dashLength: 8 }) } });
        }
        e.position = new C.ConstantPositionProperty(pos);
        if (e.billboard) e.billboard.rotation = new C.ConstantProperty(-C.Math.toRadians(tr.state.trackDeg ?? 0));
        const showLines = sel === k || tracks.current.size < 150;
        const trail = viewer.entities.getById(`trail:${k}`), pred = viewer.entities.getById(`pred:${k}`);
        if (trail?.polyline) trail.polyline.positions = new C.ConstantProperty(showLines && tr.trail.length > 1 ? tr.trail.map((q) => C.Cartesian3.fromDegrees(q.lon, q.lat, q.alt)) : []);
        if (pred?.polyline) pred.polyline.positions = new C.ConstantProperty(showLines ? [C.Cartesian3.fromDegrees(tr.state.lon, tr.state.lat, tr.state.altM ?? 0), pos] : []);
      }
      force((x) => x + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [C, demo, sel]);

  const s = sel ? tracks.current.get(sel) : null;
  const pred = s ? extrapolate(s.state, Date.now() / 1000, 90) : null;
  return (
    <div className="relative h-full w-full bg-space">
      <div ref={el} className="absolute inset-0" aria-label="Aircraft map" />
      {error && <div className="absolute inset-0 grid place-items-center text-alert">{error}</div>}
      <div className="absolute left-4 top-20 z-20 w-[300px] space-y-2">
        <div className="glass p-3 text-[12px]">
          <div className="mb-2 flex items-center justify-between"><span className="label">Flights</span>{meta && <DataBadge value={meta.dataClass} />}</div>
          <div className="flex gap-1" role="tablist">
            <button role="tab" aria-selected={!demo} className={`btn ${!demo ? "btn-primary" : ""}`} onClick={() => setDemo(false)}>OpenSky</button>
            <button role="tab" aria-selected={demo} className={`btn ${demo ? "btn-primary" : ""}`} onClick={() => setDemo(true)}>Demo (SIMULATED)</button>
          </div>
          {meta && <p className="mt-2 text-starlight/70">{meta.count} aircraft in view{meta.auth ? ` · ${meta.auth} access` : ""}{meta.fetchedAt ? ` · fetched ${new Date(meta.fetchedAt).toLocaleTimeString()}` : ""}</p>}
          {meta?.notice && <p className={`mt-1 text-[11px] ${demo ? "text-sim" : "text-starlight/55"}`}>{meta.notice}</p>}
          <div className="mt-2 space-y-0.5 border-t hairline pt-2 text-[10px] text-starlight/50">
            <p><span className="inline-block w-6 border-t-2 border-teal align-middle" /> observed positions (received)</p>
            <p><span className="inline-block w-6 border-t-2 border-dashed border-starlight/70 align-middle" /> predicted (dead reckoning ≤90 s)</p>
            <p>FAA SWIM: {meta?.swim?.notice ?? "UNAVAILABLE"}</p>
          </div>
        </div>
      </div>
      {s && pred && (
        <aside className="glass fade-in absolute right-4 top-20 z-20 w-[290px] p-4 text-[12px]" aria-label="Aircraft details">
          <div className="flex items-start justify-between"><div><h2 className="text-[16px] font-medium">{s.raw.callsign ?? s.raw.icao24}</h2><p className="mono text-[11px] text-violet">ICAO24 {s.raw.icao24}{s.raw.originCountry ? ` · ${s.raw.originCountry}` : ""}</p></div>{s.raw.simulated ? <DataBadge value="SIMULATED" size="xs" /> : <DataBadge value={meta?.dataClass ?? "DELAYED"} size="xs" />}</div>
          <dl className="mt-2 grid grid-cols-2 gap-y-1">
            <dt className="text-starlight/50">Last fix</dt><dd className="mono text-right">{new Date(s.state.t * 1000).toLocaleTimeString()}</dd>
            <dt className="text-starlight/50">Fix lat/lon</dt><dd className="mono text-right">{s.state.lat.toFixed(3)}, {s.state.lon.toFixed(3)}</dd>
            <dt className="text-starlight/50">Predicted now</dt><dd className="mono text-right">{pred.lat.toFixed(3)}, {pred.lon.toFixed(3)} <span className="text-starlight/40">(+{pred.predictedSeconds.toFixed(0)}s)</span></dd>
            <dt className="text-starlight/50">Altitude</dt><dd className="mono text-right">{s.state.altM != null ? `${Math.round(s.state.altM).toLocaleString()} m` : "n/a"}</dd>
            <dt className="text-starlight/50">Ground speed</dt><dd className="mono text-right">{s.state.velocityMs != null ? `${(s.state.velocityMs * 1.94384).toFixed(0)} kt` : "n/a"}</dd>
            <dt className="text-starlight/50">Track</dt><dd className="mono text-right">{s.state.trackDeg != null ? `${s.state.trackDeg.toFixed(0)}°` : "n/a"}</dd>
            <dt className="text-starlight/50">Vertical rate</dt><dd className="mono text-right">{s.state.verticalRateMs != null ? `${s.state.verticalRateMs.toFixed(1)} m/s` : "n/a"}</dd>
            {s.raw.squawk && <><dt className="text-starlight/50">Squawk</dt><dd className="mono text-right">{s.raw.squawk}</dd></>}
          </dl>
          <p className="mt-2 text-[10px] text-starlight/40">{s.raw.simulated ? "Synthetic aircraft generated by AETHERRA. Not a real flight." : "Source: The OpenSky Network. Route/origin/destination are not provided by this feed and are not guessed."}</p>
          <button className="btn mt-2" onClick={() => setSel(null)}>Close</button>
        </aside>
      )}
    </div>
  );
}
