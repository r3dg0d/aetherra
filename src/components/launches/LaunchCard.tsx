"use client";
import Link from "next/link";
import type { NormalizedLaunch } from "@/providers/launches/types";
import { formatCountdown, precisionLabel } from "@/providers/launches/countdown";
import { RemindButton } from "./RemindButton";

const STATUS_COLOR: Record<string, string> = { Go: "#42E2D0", TBC: "#52BFFF", TBD: "#A78BFA", Hold: "#FFB454", "In Flight": "#42E2D0", Success: "#42E2D0", Failure: "#FF6B81", "Partial Failure": "#FFB454" };

export function flyToPadHref(l: Pick<NormalizedLaunch, "padLat" | "padLon" | "padName">) {
  return `/earth?lat=${l.padLat}&lon=${l.padLon}&alt=3500&label=${encodeURIComponent(l.padName ?? "Launch pad")}&pad=1`;
}

export function LaunchCard({ l, now, past }: { l: NormalizedLaunch; now: number; past?: boolean }) {
  const c = STATUS_COLOR[l.statusAbbrev] ?? "#F4F7FF";
  const tz = l.locationTz ?? "UTC";
  return (
    <article className="glass flex flex-col gap-2 p-4" aria-label={l.name}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-violet" title="Launch operator · customers">{l.operatorName}{l.customers.length ? <span className="text-starlight/45"> for {l.customers.slice(0, 2).join(", ")}</span> : null}</p>
          <h3 className="text-[14px] font-medium leading-snug">{l.missionName ?? l.name}</h3>
          <p className="text-[11px] text-starlight/50">{l.rocketName}{l.orbit ? ` → ${l.orbit}` : ""}</p>
        </div>
        <span className="mono shrink-0 rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${c}66`, color: c }} title={l.statusName}>{l.statusAbbrev}</span>
      </div>
      {!past ? (
        <div>
          <p className="mono text-[20px]">{formatCountdown(l.net, l.netPrecision, now)}</p>
          <p className="text-[10px] text-starlight/45">{precisionLabel(l.netPrecision)}</p>
        </div>
      ) : l.failReason ? <p className="text-[11px] text-alert">{l.failReason}</p> : null}
      <div className="text-[11px] text-starlight/70">
        <div className="mono">{new Date(l.net).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} <span className="text-starlight/40">your time</span></div>
        <div className="mono text-starlight/45">{new Date(l.net).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" })} at pad ({tz})</div>
        <div className="mt-1 truncate">{l.padName}{l.locationName ? ` · ${l.locationName}` : ""}</div>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <Link className="btn" href={`/launches/${l.id}`}>Details</Link>
        {l.padLat != null && <Link className="btn" href={flyToPadHref(l)}>Fly to pad</Link>}
        {l.vidUrls[0] && <a className="btn" href={l.vidUrls[0].url} target="_blank" rel="noopener noreferrer">{past ? "Recording ↗" : l.webcastLive ? "● Live ↗" : "Stream ↗"}</a>}
        {!past && <RemindButton scope="launch" target={l.id} />}
      </div>
    </article>
  );
}
