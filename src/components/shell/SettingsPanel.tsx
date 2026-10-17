"use client";
import Link from "next/link";
import { useApp, type Quality } from "@/lib/store/app";
import { usePerf } from "@/lib/quality";
import { audio } from "@/lib/audio/engine";

const QUALITIES: { id: Quality; label: string }[] = [
  { id: "auto", label: "Auto" }, { id: "low", label: "Low" }, { id: "medium", label: "Med" }, { id: "high", label: "High" }, { id: "ultra", label: "Ultra" },
];

function Toggle({ label, checked, onChange, hint, testId }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; testId?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-[13px]">
      <span>{label}{hint && <span className="block text-[10px] text-starlight/45">{hint}</span>}</span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  );
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const autoTier = usePerf((p) => p.autoTier);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      <div className="glass glass-strong sheet-panel fixed z-50 p-4" role="dialog" aria-label="Settings" data-testid="settings-panel">
        <div className="sheet-handle md:hidden" aria-hidden />
        <div className="mb-2 flex items-center justify-between"><span className="label">Settings</span><button onClick={onClose} aria-label="Close settings" className="icon-btn text-starlight/60">✕</button></div>
        <fieldset className="mb-3">
          <legend className="mb-1 text-[13px]">Graphics quality</legend>
          <div className="grid grid-cols-5 gap-1">
            {QUALITIES.map((q) => (
              <button key={q.id} className={`btn justify-center px-1 ${s.quality === q.id ? "btn-primary" : ""}`} onClick={() => s.setQuality(q.id)} aria-pressed={s.quality === q.id}>{q.label}</button>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-starlight/45">
            {s.quality === "auto" ? `Auto is running at ${autoTier.toUpperCase()}, with dynamic resolution following frame rate. ` : ""}
            Low: 2K textures, no bloom/clouds. Med: bloom, clouds, Milky Way. High: 4K. Ultra: supersampled.
          </p>
        </fieldset>
        <Toggle label="Cloud layer" hint="Static NASA Blue Marble composite. Illustrative, not live weather." checked={s.showClouds} onChange={s.setShowClouds} />
        <Toggle label="Reduce motion" hint="No intro, instant camera moves, calmer audio" checked={s.reducedMotion} onChange={s.setReducedMotion} />
        <Toggle label="Performance panel" checked={s.showPerf} onChange={() => s.togglePerf()} testId="perf-toggle" />
        <fieldset className="mt-2 border-t border-violet/15 pt-2">
          <legend className="sr-only">Sound</legend>
          <Toggle label="Sound" hint="Cinematic, synthesized sound. Not real space acoustics." checked={!s.muted} onChange={(on) => { if (on) audio.unlock(); s.setMuted(!on); }} testId="sound-toggle" />
          <label className="flex min-h-[44px] items-center justify-between gap-3 text-[13px]">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => s.setVolume(Number(e.target.value))} className="w-36" aria-label="Volume" disabled={s.muted} />
          </label>
          <Toggle label="Ambient drones" checked={s.ambient} onChange={s.setAmbient} />
          <Toggle label="Interface ticks" checked={s.uiSounds} onChange={s.setUiSounds} />
        </fieldset>
        <fieldset className="mt-2 border-t border-violet/15 pt-2">
          <legend className="text-[13px]">AETHERRA Voice <span className="text-[10px] text-starlight/45">(simulated assistant)</span></legend>
          <Toggle label="Voice replies" hint="Spoken answers. Still requires sound on; reduced motion silences them." checked={s.voiceReplies} onChange={s.setVoiceReplies} testId="voice-replies-toggle" />
          <label className="flex min-h-[44px] items-center justify-between gap-3 text-[13px]"><span>Voice rate</span><input type="range" min={0.6} max={1.5} step={0.1} value={s.voiceRate} onChange={(e) => s.setVoiceRate(Number(e.target.value))} className="w-36" aria-label="Voice rate" /></label>
          <label className="flex min-h-[44px] items-center justify-between gap-3 text-[13px]"><span>Voice pitch</span><input type="range" min={0.5} max={1.6} step={0.1} value={s.voicePitch} onChange={(e) => s.setVoicePitch(Number(e.target.value))} className="w-36" aria-label="Voice pitch" /></label>
        </fieldset>
        <p className="mt-2 text-[10px] text-starlight/45">Press <kbd className="mono">H</kbd> (or the eye button) to hide the interface for screenshots.</p>
        <Link href="/status" className="mt-2 inline-flex min-h-[44px] items-center text-[12px] text-celestial" onClick={onClose}>Data sources, attribution &amp; provider status →</Link>
      </div>
    </>
  );
}
