"use client";
import { useTime, simNow } from "@/lib/store/time";
import { useNow, useHydrated } from "@/lib/useNow";

const SPEEDS = [-3600, -60, 1, 10, 60, 600, 3600, 86400];
const fmtSpeed = (s: number) => (Math.abs(s) >= 86400 ? `${s / 86400}d/s` : Math.abs(s) >= 3600 ? `${s / 3600}h/s` : Math.abs(s) >= 60 ? `${s / 60}m/s` : `${s}×`);

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(ms - off).toISOString().slice(0, 16);
}

/** Time machine: LIVE / pause / play / speed / date. */
export function TimeControls({ compact = false }: { compact?: boolean }) {
  const t = useTime();
  const real = useNow(500);
  const sim = simNow(t, real);
  return (
    <div className="glass flex flex-wrap items-center gap-1.5 px-3 py-2" role="group" aria-label="Time machine">
      <span className="label mr-1">Time</span>
      <button className={`btn ${t.mode === "live" ? "btn-primary" : ""}`} onClick={t.goLive} aria-pressed={t.mode === "live"}>
        <span className={`h-1.5 w-1.5 rounded-full ${t.mode === "live" ? "live-dot bg-teal" : "bg-starlight/40"}`} /> LIVE
      </button>
      <button className="btn" onClick={() => (t.mode === "paused" ? t.play() : t.pause())} aria-label={t.mode === "paused" ? "Play" : "Pause"}>{t.mode === "paused" ? "▶" : "⏸"}</button>
      <button className="btn" onClick={() => t.step(-3600_000)} aria-label="Back one hour">−1h</button>
      <button className="btn" onClick={() => t.step(3600_000)} aria-label="Forward one hour">+1h</button>
      {!compact && <button className="btn" onClick={() => t.step(86400_000)} aria-label="Forward one day">+1d</button>}
      <select className="input" aria-label="Playback speed" value={t.mode === "live" ? 1 : t.speed} onChange={(e) => { const v = Number(e.target.value); if (v === 1 && t.mode === "live") return; t.play(v); }}>
        {SPEEDS.map((s) => <option key={s} value={s}>{fmtSpeed(s)}</option>)}
      </select>
      <input type="datetime-local" className="input mono" aria-label="Simulation date and time (local)" value={toLocalInput(sim)} onChange={(e) => { const ms = new Date(e.target.value).getTime(); if (Number.isFinite(ms)) t.setTime(ms); }} />
    </div>
  );
}
