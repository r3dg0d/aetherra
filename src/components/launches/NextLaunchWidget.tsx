"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNow } from "@/lib/useNow";
import { formatCountdown, precisionLabel } from "@/providers/launches/countdown";
import type { NormalizedLaunch } from "@/providers/launches/types";
import type { DataClass } from "@/lib/classification";
import { DataBadge } from "@/components/shell/DataBadge";
import { RemindButton } from "./RemindButton";

export function NextLaunchWidget({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ data: NormalizedLaunch | null; verified: boolean; dataClass: DataClass; fetchedAt?: string; stale?: boolean } | null>(null);
  const now = useNow(1000);
  useEffect(() => {
    const load = () => fetch("/api/launches/next").then((r) => r.json()).then(setState).catch(() => setState({ data: null, verified: false, dataClass: "UNAVAILABLE" }));
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  const l = state?.data;
  return (
    <section className={`glass fade-in w-[300px] p-4 ${className}`} aria-label="Next rocket launch">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Next rocket launch</span>
        {state && <DataBadge value={state.stale && state.dataClass === "LIVE" ? "DELAYED" : state.dataClass} size="xs" note={state.fetchedAt ? `schedule fetched ${new Date(state.fetchedAt).toLocaleTimeString()}` : undefined} />}
      </div>
      {!state && <p className="text-[12px] text-starlight/50">Loading verified schedule…</p>}
      {state && !l && <p className="text-[12px] text-starlight/60">No launch schedule available right now (Launch Library 2 unreachable or quota exhausted). Nothing is shown rather than a sample.</p>}
      {l && (
        <>
          <p className="text-[11px] text-violet">{[l.operatorName, ...l.customers.slice(0, 1)].filter(Boolean).join(" / ")}</p>
          <h3 className="mt-0.5 text-[14px] font-medium leading-snug">{l.missionName ?? l.name}</h3>
          <p className="text-[11px] text-starlight/50">{l.rocketName}</p>
          <p className="mono mt-2 text-[22px] tracking-wide text-starlight">{formatCountdown(l.net, l.netPrecision, now)}</p>
          <p className="text-[10px] text-starlight/45">{precisionLabel(l.netPrecision)} · {l.statusName}{!state?.verified && " · not yet confirmed"}</p>
          <p className="mt-1 text-[11px] text-starlight/70">{l.padName}{l.locationName ? `, ${l.locationName}` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link className="btn" href={`/launches/${l.id}`}>Mission details</Link>
            {l.vidUrls[0] ? <a className="btn" href={l.vidUrls[0].url} target="_blank" rel="noopener noreferrer">Watch live ↗</a> : <span className="btn opacity-50" title="No official stream listed yet">No stream yet</span>}
            <RemindButton scope="launch" target={l.id} />
          </div>
        </>
      )}
    </section>
  );
}
