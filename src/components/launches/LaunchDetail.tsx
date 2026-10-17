"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { NormalizedLaunch } from "@/providers/launches/types";
import type { StreamInfo } from "@/providers/launches/livestream";
import type { ReconSample } from "@/providers/launches/reconstruction";
import { formatCountdown, precisionLabel } from "@/providers/launches/countdown";
import { timelineAt, formatRelative } from "@/providers/launches/timeline";
import { useNow } from "@/lib/useNow";
import { useView } from "@/lib/store/app";
import { DataBadge } from "@/components/shell/DataBadge";
import { RemindButton } from "./RemindButton";
import { ReconPlot } from "./ReconPlot";
import { flyToPadHref } from "./LaunchCard";
import type { DataClass } from "@/lib/classification";

interface Detail {
  data: NormalizedLaunch & { fetchedAt: string }; updates: { id: number; kind: string; fromValue: string | null; toValue: string | null; detectedAt: string }[];
  streams: StreamInfo[]; official: { label: string; url: string }[]; reconstruction: { classification: "SIMULATED"; note: string; samples: ReconSample[] } | null; dataClass: DataClass;
}

export default function LaunchDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"stream" | "recon">("stream");
  const now = useNow(1000);
  useEffect(() => {
    fetch(`/api/launches/${id}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); setD(j); }).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { if (d) useView.getState().setData(d.dataClass, `Launch Library 2 · record fetched ${new Date(d.data.fetchedAt).toLocaleString()}`); useView.getState().setCamera(null); }, [d]);
  if (err) return <div className="grid h-full place-items-center text-starlight/60">Launch not available: {err}. <Link className="text-celestial" href="/launches">Back</Link></div>;
  if (!d) return <div className="grid h-full place-items-center text-starlight/50">Loading mission…</div>;
  const l = d.data;
  const tz = l.locationTz ?? "UTC";
  const tl = timelineAt(l.timeline, l.net, now);
  const sinceT0 = (now - Date.parse(l.net)) / 1000;
  const embed = d.streams.find((s) => s.embedUrl);
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#080F20,_#030409_60%)] px-4 pb-28 pt-20 md:px-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-4">
          <div className="glass p-5">
            <Link href="/launches" className="text-[11px] text-celestial">← Mission Control</Link>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] text-violet">{l.operatorName}{l.customers.length ? <span className="text-starlight/50"> · customers: {l.customers.join(", ")}</span> : null}</p>
                <h1 className="text-[24px] font-light">{l.missionName ?? l.name}</h1>
                <p className="text-[12px] text-starlight/55">{l.rocketName}{l.rocketFamily ? ` (${l.rocketFamily} family)` : ""}{l.orbit ? ` → ${l.orbit}` : ""}{l.missionType ? ` · ${l.missionType}` : ""}</p>
              </div>
              <DataBadge value={d.dataClass} />
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-6">
              <div><p className="label">Countdown</p><p className="mono text-[30px]">{formatCountdown(l.net, l.netPrecision, now)}</p><p className="text-[10px] text-starlight/45">{precisionLabel(l.netPrecision)}</p></div>
              <div className="text-[12px]"><p className="label">Status</p><p>{l.statusName}</p>{l.probability != null && <p className="text-starlight/50">Weather go: {l.probability}%</p>}</div>
              <div className="mono text-[12px]">
                <p className="label">NET</p>
                <p>{new Date(l.net).toISOString().replace(".000Z", "Z")}</p>
                <p className="text-starlight/60">{new Date(l.net).toLocaleString([], { dateStyle: "medium", timeStyle: "long" })}</p>
                <p className="text-starlight/45">{new Date(l.net).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short", timeZoneName: "short" })} (pad local)</p>
                {l.windowStart && l.windowEnd && l.windowStart !== l.windowEnd && <p className="text-starlight/45">Window {new Date(l.windowStart).toISOString().slice(11, 16)}–{new Date(l.windowEnd).toISOString().slice(11, 16)} UTC</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {l.padLat != null && <Link className="btn btn-primary" href={flyToPadHref(l)}>Fly globe to pad</Link>}
              <RemindButton scope="launch" target={l.id} />
              <a className="btn" href={`/api/launches/ics?id=${l.id}`}>Add to calendar</a>
              {d.official.map((o) => <a key={o.url} className="btn" href={o.url} target="_blank" rel="noopener noreferrer">{o.label} ↗</a>)}
            </div>
          </div>
          <div className="glass p-4">
            <div className="mb-2 flex items-center justify-between">
              <div role="tablist" className="flex gap-1">
                <button role="tab" aria-selected={view === "stream"} className={`btn ${view === "stream" ? "btn-primary" : ""}`} onClick={() => setView("stream")}>Official broadcast</button>
                <button role="tab" aria-selected={view === "recon"} className={`btn ${view === "recon" ? "btn-primary" : ""}`} onClick={() => setView("recon")}>3D/flight profile</button>
              </div>
              {view === "recon" ? <DataBadge value="SIMULATED" /> : embed ? <span className="label">{embed.kind === "recording" ? "ARCHIVAL VIDEO" : "LIVESTREAM"}</span> : null}
            </div>
            {view === "stream" && (embed ? (
              <div>
                <div className="aspect-video overflow-hidden rounded-lg border hairline"><iframe src={embed.embedUrl!} title={embed.title ?? "Launch broadcast"} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
                <p className="mt-1 text-[10px] text-starlight/45">{embed.publisher ?? "Publisher"} · link listed by Launch Library 2 · {embed.official ? "official channel" : "verify source before relying on it"}</p>
              </div>
            ) : d.streams.length ? (
              <ul className="space-y-1 text-[12px]">{d.streams.map((s) => <li key={s.url}><a className="text-celestial" href={s.url} target="_blank" rel="noopener noreferrer">{s.title ?? s.url} ↗</a> <span className="text-starlight/40">{s.publisher}</span></li>)}</ul>
            ) : <p className="text-[12px] text-starlight/50">No broadcast link has been published for this mission yet.</p>)}
            {view === "recon" && d.reconstruction && (
              <div>
                <p className="mb-1 text-[11px] font-medium tracking-[0.16em] text-sim">RECONSTRUCTED — SIMULATED FLIGHT PATH</p>
                <ReconPlot samples={d.reconstruction.samples} progressS={sinceT0 >= 0 && sinceT0 < 600 ? sinceT0 : null} />
                <p className="text-[10px] text-starlight/45">{d.reconstruction.note} Milestones placed from the LL2 timeline where published. <Link className="text-celestial" href={`/earth?lat=${l.padLat}&lon=${l.padLon}&alt=900000&label=${encodeURIComponent(l.padName ?? "Pad")}&recon=${l.id}`}>View on globe →</Link></p>
              </div>
            )}
          </div>
          {l.missionDescription && <div className="glass p-4 text-[13px] leading-relaxed text-starlight/80"><p className="label mb-1">Mission</p>{l.missionDescription}</div>}
        </section>
        <section className="flex flex-col gap-4">
          {l.imageUrl && <figure className="glass overflow-hidden p-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={l.imageUrl} alt={l.name} className="max-h-64 w-full object-cover" loading="lazy" /><figcaption className="px-3 py-1 text-[10px] text-starlight/40">Image: {l.imageCredit ?? "via Launch Library 2"}</figcaption></figure>}
          {l.patches.length > 0 && <div className="glass flex gap-2 p-3">{l.patches.map((p) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={p.imageUrl} src={p.imageUrl} alt={p.name} title={p.name} className="h-16 w-16 object-contain" loading="lazy" />)}</div>}
          <div className="glass p-4">
            <p className="label mb-2">Mission timeline {tl.length === 0 && "· not published"}</p>
            <ol className="space-y-1 text-[12px]">
              {tl.map((e, i) => (
                <li key={i} className={`flex justify-between gap-2 border-b hairline pb-1 ${e.passed ? "text-starlight/40" : ""}`} title={e.description}>
                  <span>{e.abbrev}</span><span className="mono">{formatRelative(e.relativeSeconds)}</span>
                </li>
              ))}
            </ol>
            {tl.length > 0 && <p className="mt-1 text-[10px] text-starlight/40">Planned offsets from T-0 published in LL2. Passed events are greyed by clock, not by telemetry.</p>}
          </div>
          <div className="glass p-4 text-[12px]">
            <p className="label mb-2">Launch site</p>
            <p>{l.padName}</p><p className="text-starlight/55">{l.locationName}</p>
            {l.padLat != null && <p className="mono text-[11px] text-starlight/45">{l.padLat.toFixed(4)}°, {l.padLon!.toFixed(4)}°</p>}
          </div>
          <div className="glass p-4 text-[12px]">
            <p className="label mb-2">Schedule changes detected by AETHERRA</p>
            {d.updates.length === 0 && <p className="text-starlight/50">No changes recorded since AETHERRA started tracking this launch.</p>}
            <ul className="space-y-1">{d.updates.map((u) => <li key={u.id} className="border-b hairline pb-1"><span className="text-violet">{u.kind.replace("_", " ")}</span> <span className="mono text-[10px] text-starlight/40">{new Date(u.detectedAt).toLocaleString()}</span><div className="mono text-[10px] text-starlight/60">{u.fromValue} → {u.toValue}</div></li>)}</ul>
          </div>
          <div className="glass p-4 text-[12px]">
            <p className="label mb-2">Links</p>
            <ul className="space-y-1">{l.infoUrls.map((u) => <li key={u.url}><a className="text-celestial" href={u.url} target="_blank" rel="noopener noreferrer">{u.title ?? u.url} ↗</a></li>)}{l.infoUrls.length === 0 && <li className="text-starlight/50">None published.</li>}</ul>
          </div>
        </section>
      </div>
    </div>
  );
}
