"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type * as CesiumNS from "cesium";
import { useCesium, createViewer, osmLayer, type CesiumLib } from "./useCesium";
import { GIBS_LAYERS, GIBS_ATTRIBUTION, gibsTemplate, defaultGibsDate } from "@/providers/gibs/layers";
import { LAUNCH_SITES, WEBCAM_DIRECTORY } from "@/lib/data/places";
import { useView } from "@/lib/store/app";
import { DataBadge } from "@/components/shell/DataBadge";
import type { NormalizedLaunch } from "@/providers/launches/types";

type Base = "osm" | string;

function makeLayer(C: CesiumLib, id: Base, date: string) {
  if (id === "osm") return osmLayer(C);
  const l = GIBS_LAYERS.find((g) => g.id === id)!;
  return new C.ImageryLayer(new C.UrlTemplateImageryProvider({ url: gibsTemplate(l, date), maximumLevel: l.level, credit: new C.Credit(GIBS_ATTRIBUTION) }));
}

export default function EarthPage() {
  const { Cesium: C, error } = useCesium();
  const el = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumNS.Viewer | null>(null);
  const [base, setBase] = useState<Base>("osm");
  const [compare, setCompare] = useState<Base | "">("");
  const [date, setDate] = useState(defaultGibsDate());
  const [split, setSplit] = useState(0.5);
  const [lampState, setLampState] = useState<string>("");
  const [site, setSite] = useState<(typeof LAUNCH_SITES)[number] | null>(null);
  const [siteLaunches, setSiteLaunches] = useState<NormalizedLaunch[] | null>(null);
  const [panel, setPanel] = useState<"layers" | "sites" | "webcams">("layers");
  const [ion, setIon] = useState(false);
  const lampsRef = useRef<CesiumNS.PointPrimitiveCollection | null>(null);

  // Create viewer once
  useEffect(() => {
    if (!C || !el.current || viewerRef.current) return;
    const { viewer, ionEnabled } = createViewer(C, el.current, { baseLayer: makeLayer(C, "osm", date) });
    viewerRef.current = viewer; setIon(ionEnabled);
    if (ionEnabled) {
      C.createWorldTerrainAsync().then((t) => (viewer.terrainProvider = t)).catch(() => {});
      C.createOsmBuildingsAsync().then((b) => viewer.scene.primitives.add(b)).catch(() => {});
    }
    // Launch-site markers
    for (const s of LAUNCH_SITES) {
      viewer.entities.add({ id: `site:${s.q}`, position: C.Cartesian3.fromDegrees(s.lon, s.lat), point: { pixelSize: 8, color: C.Color.fromCssColorString("#7956FF"), outlineColor: C.Color.fromCssColorString("#F4F7FF"), outlineWidth: 1 }, label: { text: s.name, font: "11px sans-serif", fillColor: C.Color.fromCssColorString("#F4F7FF"), pixelOffset: new C.Cartesian2(10, -10), horizontalOrigin: C.HorizontalOrigin.LEFT, scaleByDistance: new C.NearFarScalar(1e5, 1, 8e6, 0), showBackground: true, backgroundColor: C.Color.fromCssColorString("#080F20").withAlpha(0.7) } });
    }
    const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((e: { position: CesiumNS.Cartesian2 }) => {
      const picked = viewer.scene.pick(e.position);
      const id = picked?.id?.id as string | undefined;
      if (id?.startsWith("site:")) { const s = LAUNCH_SITES.find((x) => `site:${x.q}` === id)!; setSite(s); setPanel("sites"); }
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((e: { endPosition: CesiumNS.Cartesian2 }) => {
      const c = viewer.camera.pickEllipsoid(e.endPosition);
      if (c) { const g = C.Cartographic.fromCartesian(c); useView.getState().setCursor({ lat: C.Math.toDegrees(g.latitude), lon: C.Math.toDegrees(g.longitude) }); } else useView.getState().setCursor(null);
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
    const onCam = () => {
      const g = viewer.camera.positionCartographic;
      const altKm = g.height / 1000;
      useView.getState().setCamera({ lat: C.Math.toDegrees(g.latitude), lon: C.Math.toDegrees(g.longitude), altKm, distanceKm: altKm + 6371 });
    };
    viewer.camera.changed.addEventListener(onCam); viewer.camera.percentageChanged = 0.01; onCam();
    // Deep link: ?lat&lon&alt&label[&pad=1][&recon=<launchId>]
    const sp = new URLSearchParams(window.location.search);
    const lat = Number(sp.get("lat")), lon = Number(sp.get("lon"));
    if (sp.get("lat") && Number.isFinite(lat) && Number.isFinite(lon)) {
      const alt = Number(sp.get("alt")) || 20000;
      viewer.entities.add({ position: C.Cartesian3.fromDegrees(lon, lat), point: { pixelSize: 10, color: C.Color.fromCssColorString("#42E2D0") }, label: { text: sp.get("label") ?? "", font: "12px sans-serif", pixelOffset: new C.Cartesian2(12, -12), horizontalOrigin: C.HorizontalOrigin.LEFT, fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString("#080F20").withAlpha(0.75) } });
      viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(lon, lat, alt), orientation: { heading: 0, pitch: C.Math.toRadians(alt < 50000 ? -45 : -90), roll: 0 }, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 4 });
    } else {
      viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(-40, 25, 2.2e7) });
    }
    const recon = sp.get("recon");
    if (recon) fetch(`/api/launches/${recon}`).then((r) => r.json()).then((j) => {
      const s = j.reconstruction?.samples as { lat: number; lon: number; altKm: number }[] | undefined;
      if (!s) return;
      viewer.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(s.flatMap((p) => [p.lon, p.lat, p.altKm * 1000])), width: 2, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString("#FFB454") }) } });
      const last = s[s.length - 1];
      viewer.entities.add({ position: C.Cartesian3.fromDegrees(last.lon, last.lat, last.altKm * 1000), label: { text: "SIMULATED FLIGHT PATH (reconstruction)", font: "11px sans-serif", fillColor: C.Color.fromCssColorString("#FFB454"), showBackground: true, backgroundColor: C.Color.fromCssColorString("#080F20").withAlpha(0.8) } });
    });
    return () => { handler.destroy(); viewer.destroy(); viewerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [C]);

  // Base + compare layers
  useEffect(() => {
    const v = viewerRef.current; if (!C || !v) return;
    const layers = v.imageryLayers;
    layers.removeAll();
    const b = makeLayer(C, base, date); layers.add(b);
    if (compare) {
      const c = makeLayer(C, compare, date); layers.add(c);
      b.splitDirection = C.SplitDirection.LEFT; c.splitDirection = C.SplitDirection.RIGHT;
    }
    v.scene.splitPosition = split;
    const gibs = base !== "osm" || !!compare;
    useView.getState().setData("HISTORICAL", gibs ? `${GIBS_ATTRIBUTION}${GIBS_LAYERS.find((g) => g.id === base)?.daily ? ` · ${date}` : ""}` : "© OpenStreetMap contributors (map tiles)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [C, base, compare, date]);
  useEffect(() => { if (viewerRef.current) viewerRef.current.scene.splitPosition = split; }, [split]);

  useEffect(() => {
    if (!site) return;
    fetch(`/api/launches?window=upcoming&q=${encodeURIComponent(site.q)}&limit=6`).then((r) => r.json()).then((j) => setSiteLaunches(j.data ?? [])).catch(() => setSiteLaunches([]));
    viewerRef.current?.camera.flyTo({ destination: C!.Cartesian3.fromDegrees(site.lon, site.lat, 6000), orientation: { heading: 0, pitch: C!.Math.toRadians(-40), roll: 0 }, duration: 3 });
  }, [site, C]);

  async function loadStreetlights() {
    const v = viewerRef.current; if (!C || !v) return;
    const rect = v.camera.computeViewRectangle();
    if (!rect) return setLampState("Point the camera at the ground first.");
    const b = { s: C.Math.toDegrees(rect.south), w: C.Math.toDegrees(rect.west), n: C.Math.toDegrees(rect.north), e: C.Math.toDegrees(rect.east) };
    if ((b.n - b.s) * (b.e - b.w) > 0.05) return setLampState("Zoom in to city-block scale (view < 0.05 sq°) to load street lamps.");
    setLampState("Querying OpenStreetMap (Overpass)…");
    const r = await fetch(`/api/streetlights?s=${b.s}&w=${b.w}&n=${b.n}&e=${b.e}`).then((r) => r.json());
    if (r.dataClass === "UNAVAILABLE") return setLampState(`Unavailable: ${r.notice}`);
    if (lampsRef.current) v.scene.primitives.remove(lampsRef.current);
    const col = v.scene.primitives.add(new C.PointPrimitiveCollection()) as CesiumNS.PointPrimitiveCollection;
    for (const l of r.data as { lat: number; lon: number }[]) col.add({ position: C.Cartesian3.fromDegrees(l.lon, l.lat, 6), pixelSize: 5, color: C.Color.fromCssColorString("#FFD58A").withAlpha(0.95), outlineColor: C.Color.fromCssColorString("#FFB454").withAlpha(0.4), outlineWidth: 3 });
    lampsRef.current = col;
    setLampState(`${r.data.length} mapped street lamps (OSM highway=street_lamp). Positions only, not live lighting state.`);
  }

  const daily = GIBS_LAYERS.find((g) => g.id === base)?.daily || GIBS_LAYERS.find((g) => g.id === compare)?.daily;
  return (
    <div className="relative h-full w-full bg-space">
      <div ref={el} className="absolute inset-0" aria-label="Interactive 3D globe (CesiumJS)" />
      {error && <div className="absolute inset-0 grid place-items-center text-alert">{error}</div>}
      {compare && (
        <div className="absolute inset-y-0 z-10 w-px bg-starlight/70" style={{ left: `${split * 100}%` }}>
          <input type="range" min={0.05} max={0.95} step={0.005} value={split} onChange={(e) => setSplit(+e.target.value)} aria-label="Compare slider" className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -rotate-0 opacity-80" />
        </div>
      )}
      <div className="absolute left-4 top-20 z-20 w-[300px]">
        <div className="glass p-3">
          <div className="mb-2 flex gap-1" role="tablist">{(["layers", "sites", "webcams"] as const).map((p) => <button key={p} role="tab" aria-selected={panel === p} className={`btn ${panel === p ? "btn-primary" : ""}`} onClick={() => setPanel(p)}>{p === "layers" ? "Imagery" : p === "sites" ? "Launch sites" : "Webcams"}</button>)}</div>
          {panel === "layers" && (
            <div className="space-y-2 text-[12px]">
              <label className="block"><span className="label">Base layer</span>
                <select className="input mt-1 w-full" value={base} onChange={(e) => setBase(e.target.value)}><option value="osm">OpenStreetMap (street map)</option>{GIBS_LAYERS.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
              <label className="block"><span className="label">Compare with (split view)</span>
                <select className="input mt-1 w-full" value={compare} onChange={(e) => setCompare(e.target.value)}><option value="">— none —</option><option value="osm">OpenStreetMap</option>{GIBS_LAYERS.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
              {daily && <label className="block"><span className="label">Imagery date (UTC)</span><input type="date" className="input mono mt-1 w-full" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>}
              <div className="flex items-center justify-between border-t hairline pt-2"><span>Street lamps (OSM)</span><button className="btn" onClick={loadStreetlights}>Load in view</button></div>
              {lampState && <p className="text-[10px] text-starlight/55">{lampState}</p>}
              <p className="text-[10px] text-starlight/40">3D buildings & terrain: {ion ? "Cesium ion (token configured)" : <>UNAVAILABLE without NEXT_PUBLIC_CESIUM_ION_TOKEN (optional).</>}</p>
            </div>
          )}
          {panel === "sites" && (
            <div className="text-[12px]">
              <ul className="scroll-thin max-h-56 overflow-y-auto">{LAUNCH_SITES.map((s) => <li key={s.q}><button className={`w-full rounded px-2 py-1 text-left hover:bg-nebula/15 ${site?.q === s.q ? "bg-nebula/20" : ""}`} onClick={() => setSite(s)}>{s.name}</button></li>)}</ul>
              {site && (
                <div className="mt-2 border-t hairline pt-2">
                  <p className="font-medium">{site.name}</p>
                  {!siteLaunches && <p className="text-starlight/50">Loading upcoming missions…</p>}
                  {siteLaunches?.length === 0 && <p className="text-starlight/50">No upcoming launches listed for this site.</p>}
                  <ul>{siteLaunches?.map((l) => <li key={l.id}><Link className="text-celestial" href={`/launches/${l.id}`}>{l.name}</Link> <span className="mono text-[10px] text-starlight/45">{new Date(l.net).toISOString().slice(0, 10)}</span></li>)}</ul>
                  <Link href={`/launches?q=${encodeURIComponent(site.q)}`} className="text-[11px] text-celestial">Launch history & schedule →</Link>
                </div>
              )}
            </div>
          )}
          {panel === "webcams" && (
            <div className="text-[12px]">
              <p className="mb-2 text-[10px] text-starlight/50">Official public camera portals, linked (not embedded or re-streamed). Availability and terms are set by each operator.</p>
              <ul className="space-y-1">{WEBCAM_DIRECTORY.map((w) => <li key={w.url} className="flex items-center justify-between gap-2"><span><a className="text-celestial" href={w.url} target="_blank" rel="noopener noreferrer">{w.name} ↗</a><span className="block text-[10px] text-starlight/45">{w.operator}</span></span><button className="btn" onClick={() => viewerRef.current?.camera.flyTo({ destination: C!.Cartesian3.fromDegrees(w.lon, w.lat, 40000), duration: 3 })}>Go</button></li>)}</ul>
            </div>
          )}
        </div>
      </div>
      <div className="absolute right-4 top-20 z-20"><DataBadge value="HISTORICAL" note="Map tiles and satellite imagery are archived products" /></div>
    </div>
  );
}
