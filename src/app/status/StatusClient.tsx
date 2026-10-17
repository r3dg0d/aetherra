"use client";
import { useEffect, useState } from "react";
import { DataBadge } from "@/components/shell/DataBadge";
import type { DataClass } from "@/lib/classification";

interface P { id: string; name: string; operator: string; homepage: string; license: string; termsUrl?: string; attribution: string; dataClass: DataClass; expectedRefreshSeconds: number; requiresCredentials: boolean; rateLimit?: string; envVars: { name: string; set: boolean }[]; status?: unknown }
interface Resp { providers: P[]; launches: unknown; webPush: { configured: boolean }; faaSwim: unknown; cesiumIon: { configured: boolean }; database: string }

const STATIC = [
  { name: "NASA GIBS (Worldview imagery)", note: "Loaded directly by the browser as WMTS tiles. NASA EOSDIS, no copyright restrictions; please credit NASA EOSDIS GIBS.", href: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" },
  { name: "OpenStreetMap tiles", note: "© OpenStreetMap contributors, ODbL. Tile usage policy applies (light use only).", href: "https://www.openstreetmap.org/copyright" },
  { name: "Earth textures", note: "NASA Visible Earth / Black Marble (public domain).", href: "https://visibleearth.nasa.gov/" },
  { name: "Star catalogue & constellations", note: "d3-celestial (BSD-3) derived from the Hipparcos catalogue; bundled offline.", href: "https://github.com/ofrohn/d3-celestial" },
  { name: "astronomy-engine", note: "MIT. Sun, Moon and planet positions computed locally (PREDICTED).", href: "https://github.com/cosinekitty/astronomy" },
  { name: "satellite.js", note: "MIT. SGP4/SDP4 propagation computed locally from CelesTrak elements.", href: "https://github.com/shashwatak/satellite-js" },
  { name: "CesiumJS", note: "Apache-2.0. Cesium ion terrain/buildings only if you add your own token.", href: "https://cesium.com/" },
];

export function StatusClient() {
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch("/api/providers").then((r) => r.json()).then(setD).catch((e) => setErr(String(e))); }, []);
  return (
    <div className="scroll-thin h-full overflow-y-auto px-6 pb-16 pt-20">
      <div className="mx-auto max-w-5xl space-y-6">
        <header><h1 className="text-2xl font-light tracking-wide">Data sources, attribution &amp; status</h1>
          <p className="mt-1 text-sm text-starlight/60">Every value in AETHERRA carries one of: <DataBadge value="LIVE" size="xs" /> <DataBadge value="DELAYED" size="xs" /> <DataBadge value="HISTORICAL" size="xs" /> <DataBadge value="PREDICTED" size="xs" /> <DataBadge value="SIMULATED" size="xs" /> <DataBadge value="UNAVAILABLE" size="xs" />. Simulated data is never shown as live.</p></header>
        {err && <p className="text-red-300">Could not load provider status: {err}</p>}
        {d && (
          <section className="glass grid gap-2 p-4 text-sm sm:grid-cols-4">
            <div><p className="label">Database</p><p>{d.database}</p></div>
            <div><p className="label">Web Push</p><p>{d.webPush.configured ? "VAPID configured" : "Not configured (in-app inbox only)"}</p></div>
            <div><p className="label">Cesium ion</p><p>{d.cesiumIon.configured ? "Token present" : "Not set: ellipsoid + OSM"}</p></div>
            <div><p className="label">FAA SWIM</p><p>UNAVAILABLE: {(d.faaSwim as { notice?: string })?.notice}</p></div>
          </section>
        )}
        <section className="space-y-3">
          <h2 className="label">Server-side providers</h2>
          {!d && !err && <p className="text-sm text-starlight/50">Loading…</p>}
          {d?.providers.map((p) => (
            <article key={p.id} className="glass p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{p.name}</h3><DataBadge value={p.dataClass} size="xs" /><span className="text-starlight/50">{p.operator}</span>
                <a className="ml-auto text-celestial" href={p.homepage} target="_blank" rel="noreferrer">Homepage ↗</a></div>
              <p className="mt-1 text-starlight/70">{p.attribution}</p>
              <p className="mt-1 text-[12px] text-starlight/50">Licence: {p.license}{p.termsUrl && <> · <a className="text-celestial" href={p.termsUrl} target="_blank" rel="noreferrer">terms</a></>}{p.rateLimit && <> · Rate limit: {p.rateLimit}</>} · Expected refresh {p.expectedRefreshSeconds}s</p>
              {p.envVars.length > 0 && <p className="mono mt-1 text-[11px] text-starlight/50">{p.envVars.map((e) => `${e.name}: ${e.set ? "set" : "not set"}`).join(" · ")}</p>}
              {p.status != null && <pre className="mono scroll-thin mt-2 max-h-32 overflow-auto rounded bg-black/30 p-2 text-[10px] text-starlight/60">{JSON.stringify(p.status, null, 1)}</pre>}
            </article>
          ))}
        </section>
        {d?.launches != null && <section className="glass p-4"><h2 className="label mb-2">Launch feed snapshots</h2><pre className="mono scroll-thin max-h-64 overflow-auto text-[11px] text-starlight/60">{JSON.stringify(d.launches, null, 1)}</pre></section>}
        <section className="space-y-2"><h2 className="label">Client-side &amp; bundled sources</h2>
          {STATIC.map((s) => <article key={s.name} className="glass p-3 text-sm"><a className="font-medium text-celestial" href={s.href} target="_blank" rel="noreferrer">{s.name} ↗</a><p className="text-starlight/60">{s.note}</p></article>)}
        </section>
      </div>
    </div>
  );
}
