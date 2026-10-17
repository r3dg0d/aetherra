"use client";
import { useAmbient } from "@/lib/audio/useAudio";
import { useEffect, useMemo, useState } from "react";
import type { NormalizedLaunch } from "@/providers/launches/types";
import type { DataClass } from "@/lib/classification";
import { useNow } from "@/lib/useNow";
import { useView } from "@/lib/store/app";
import { DataBadge } from "@/components/shell/DataBadge";
import { LaunchCard } from "./LaunchCard";
import { NextLaunchWidget } from "./NextLaunchWidget";
import { RemindButton } from "./RemindButton";

const PROVIDERS = ["SpaceX", "NASA", "Rocket Lab", "United Launch Alliance", "Blue Origin", "China", "ISRO", "Arianespace", "JAXA", "Roscosmos"];
const SITES = [
  { name: "Kennedy Space Center", q: "Kennedy" }, { name: "Cape Canaveral SFS", q: "Cape Canaveral" }, { name: "Starbase", q: "Starbase" },
  { name: "Vandenberg SFB", q: "Vandenberg" }, { name: "Wallops", q: "Wallops" }, { name: "Mahia (Rocket Lab LC-1)", q: "Mahia" },
];

interface Resp { data: NormalizedLaunch[]; dataClass: DataClass; fetchedAt: string | null; stale: boolean; notice?: string; source?: string }

export default function LaunchesPage() {
  useAmbient("launches");
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const [operator, setOperator] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useNow(1000);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("q")) setQ(sp.get("q")!);
    if (sp.get("operator")) setOperator(sp.get("operator")!);
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const p = new URLSearchParams({ window: tab, limit: "60" });
    if (operator) p.set("operator", operator);
    if (q.length > 1) p.set("q", q);
    const t = setTimeout(() => fetch(`/api/launches?${p}`, { signal: ctrl.signal }).then((r) => r.json()).then((j) => { setResp(j); setLoading(false); }).catch(() => {}), 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [tab, operator, q]);
  useEffect(() => {
    if (resp) useView.getState().setData(resp.dataClass, resp.fetchedAt ? `Launch Library 2 · fetched ${new Date(resp.fetchedAt).toLocaleTimeString()}${resp.stale ? " · STALE" : ""}` : "Launch Library 2 unavailable");
    useView.getState().setCamera(null);
  }, [resp]);

  const list = useMemo(() => (resp?.data ?? []).filter((l) => !status || l.statusAbbrev === status), [resp, status]);
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#080F20,_#030409_60%)] px-4 pb-28 pt-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Mission Control</p>
            <h1 className="text-[28px] font-light tracking-wide">Launches</h1>
            <p className="max-w-xl text-[12px] text-starlight/55">Real orbital launches worldwide from Launch Library 2. Countdowns follow the latest published NET and never show more precision than the source provides.</p>
          </div>
          <NextLaunchWidget />
        </header>
        {resp && (resp.stale || resp.notice) && (
          <div className="mb-3 rounded-lg border border-sim/40 bg-sim/10 px-3 py-2 text-[12px] text-sim" role="status">
            {resp.stale ? "Schedule data is stale: the last refresh from Launch Library 2 is older than expected. Showing the last good copy. " : ""}{resp.notice}
          </div>
        )}
        <div className="glass mb-4 flex flex-wrap items-center gap-2 p-3">
          <div role="tablist" className="flex gap-1">
            {(["upcoming", "previous"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`btn ${tab === t ? "btn-primary" : ""}`} onClick={() => setTab(t)}>{t === "upcoming" ? "Upcoming" : "History"}</button>)}
          </div>
          <input className="input w-56" placeholder="Search mission, rocket, pad…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search launches" />
          <select className="input" value={operator} onChange={(e) => setOperator(e.target.value)} aria-label="Provider filter">
            <option value="">All providers</option>
            {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="">Any status</option>
            {["Go", "TBC", "TBD", "Hold", "In Flight", "Success", "Failure", "Partial Failure"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="ml-auto flex items-center gap-2">
            {resp && <DataBadge value={resp.dataClass} />}
            <a className="btn" href={`/api/launches/ics${operator ? `?operator=${encodeURIComponent(operator)}` : ""}`}>Calendar (ICS)</a>
            <RemindButton scope={operator ? "operator" : "all"} target={operator || undefined} label={operator ? `Alerts: ${operator}` : "Alerts: all launches"} />
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Launch sites">
          <span className="label mr-1 self-center">Sites</span>
          {SITES.map((s) => <button key={s.q} className={`btn ${q === s.q ? "btn-primary" : ""}`} onClick={() => setQ(q === s.q ? "" : s.q)}>{s.name}</button>)}
        </div>
        {loading && !resp && <p className="text-[13px] text-starlight/50">Loading schedule…</p>}
        {resp && list.length === 0 && <p className="text-[13px] text-starlight/50">{resp.dataClass === "UNAVAILABLE" ? "Launch data is unavailable right now. No sample data is substituted." : "No launches match these filters."}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((l) => <LaunchCard key={l.id} l={l} now={now} past={tab === "previous"} />)}
        </div>
        <p className="mt-6 text-[10px] text-starlight/40">Data: Launch Library 2 by The Space Devs ({resp?.source}). Free tier is rate limited; AETHERRA caches the schedule server-side (≈15 min) and keeps the last good copy during outages.</p>
      </div>
    </div>
  );
}
