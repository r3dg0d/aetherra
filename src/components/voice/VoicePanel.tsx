"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { parseCommand, intentLabel, formatCountdown, VOICE_SUGGESTIONS } from "@/lib/voice/intents";
import { createRecognition, speechSupport, speak, stopSpeaking, type SpeechRecognitionLike } from "@/lib/voice/speech";
import { useApp } from "@/lib/store/app";
import { useTime, simNow } from "@/lib/store/time";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { allBodies, moonPhaseName, skyCondition } from "@/lib/astro/sky";
import { loadConstellations, loadStars, starLabel } from "@/lib/astro/catalog";
import { subscribeAlerts } from "@/lib/push-client";
import { DataBadge } from "@/components/shell/DataBadge";
import type { DataClass } from "@/lib/classification";

interface RunResult {
  transcript: string; intentText: string; parserConfidence: number; asrConfidence: number | null;
  action: string; reply: string; dataClass: DataClass | null; simulated: boolean; speech: string;
}
interface PendingReminder { scope: "launch" | "all"; target?: string; label: string }

const NAV_DELAY_MS = 350;

export function VoiceButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button className={`glass icon-btn ${className}`} onClick={onClick} aria-label="AETHERRA Voice (push-to-talk assistant)" title="AETHERRA Voice — push-to-talk, no wake word" data-testid="voice-open">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
    </button>
  );
}

export function VoicePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const settings = useApp();
  const reduced = useReducedMotion();
  const [support, setSupport] = useState({ recognition: false, synthesis: false });
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pending, setPending] = useState<PendingReminder | null>(null);
  const [remindNote, setRemindNote] = useState<string | null>(null);
  const recog = useRef<SpeechRecognitionLike | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) { setSupport(speechSupport()); setTimeout(() => closeRef.current?.focus(), 30); } }, [open ]);
  useEffect(() => () => { recog.current?.abort(); stopSpeaking(); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  const navigate = useCallback((href: string) => {
    if (href.startsWith("/sky") && pathname === "/sky") {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new Event("aetherra:sky-params"));
    } else router.push(href);
  }, [pathname, router]);

  const finish = useCallback((r: Omit<RunResult, "speech">) => {
    const speech = speak(r.reply, { enabled: settings.voiceReplies, muted: settings.muted, reducedMotion: reduced, rate: settings.voiceRate, pitch: settings.voicePitch });
    setResult({ ...r, speech });
  }, [settings.voiceReplies, settings.muted, settings.voiceRate, settings.voicePitch, reduced]);

  const run = useCallback(async (transcript: string, asrConfidence: number | null) => {
    const parsed = parseCommand(transcript);
    const intent = parsed.intent;
    const base = { transcript, intentText: intentLabel(intent), parserConfidence: parsed.confidence, asrConfidence, dataClass: null as DataClass | null, simulated: false };
    const done = (action: string, reply: string, extra: Partial<RunResult> = {}) => finish({ ...base, action, reply, ...extra });
    try {
      switch (intent.kind) {
        case "navigate": case "find-body": case "find-constellation": case "find-satellite": case "imagery": {
          done(intentLabel(intent), intent.kind === "imagery" ? `Opening ${intent.label}.` : `Opening ${intentLabel(intent).replace(/^(Find|Track|Open imagery:?) /, "")}.`);
          setTimeout(() => navigate(intent.href), NAV_DELAY_MS);
          break;
        }
        case "find-query": {
          const q = intent.query.toLowerCase();
          const [stars, cons] = await Promise.all([loadStars().catch(() => null), loadConstellations().catch(() => null)]);
          const con = cons?.constellations.find((c) => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q));
          if (con) { done(`Found constellation ${con.name} via star catalogue`, `Found ${con.name}. Opening it in the sky.`); setTimeout(() => navigate(`/sky?con=${con.id}`), NAV_DELAY_MS); break; }
          const star = stars?.stars.find((s) => starLabel(s).toLowerCase() === q || starLabel(s).toLowerCase().includes(q));
          if (star) { done(`Found star ${starLabel(star)} (HIP ${star[0]})`, `Found ${starLabel(star)}. Opening it in the sky.`); setTimeout(() => navigate(`/sky?hip=${star[0]}`), NAV_DELAY_MS); break; }
          const j = await fetch(`/api/search?q=${encodeURIComponent(intent.query)}`).then((r) => r.json()).catch(() => null);
          const hit = (j?.data ?? [])[0] as { label: string; href: string; type: string } | undefined;
          if (hit) { done(`Search match: ${hit.label} (${hit.type})`, `Found ${hit.label}. Opening it.`); setTimeout(() => navigate(hit.href), NAV_DELAY_MS); }
          else done("No search match", `I couldn't find "${intent.query}" in stars, constellations, satellites, launches or places. Try a planet, constellation, ISS, or a city name.`);
          break;
        }
        case "next-launch": case "remind-next": {
          const j = await fetch("/api/launches?window=upcoming&limit=20").then((r) => r.json()).catch(() => null);
          const now = Date.now();
          const launches = ((j?.data ?? []) as { id: string; name: string; net: string; operatorName: string | null; locationName: string | null; padName: string | null }[])
            .filter((l) => new Date(l.net).getTime() > now - 3600_000).sort((a, b) => +new Date(a.net) - +new Date(b.net));
          const l = launches[0];
          if (!l || j?.dataClass === "UNAVAILABLE") { done("Launch Library 2 unavailable", "Launch data is unavailable right now, so I can't name the next launch rather than guessing.", { dataClass: "UNAVAILABLE" }); break; }
          const net = new Date(l.net);
          const reply = `Next launch: ${l.name}${l.operatorName ? ` by ${l.operatorName}` : ""}, from ${l.locationName ?? l.padName ?? "an unlisted pad"}, at ${net.toISOString().replace("T", " ").slice(0, 19)} UTC. That is in ${formatCountdown(net.getTime() - now, true)}.`;
          if (intent.kind === "remind-next") { setPending({ scope: "launch", target: l.id, label: l.name }); setRemindNote(null); done(`Reminder offered for ${l.name} (confirm below)`, `${reply} Tap "Set reminder" below to confirm; nothing is subscribed until you do.` , { dataClass: j.dataClass as DataClass }); }
          else done(`Answered from Launch Library 2 (${j.dataClass})`, reply, { dataClass: j.dataClass as DataClass });
          break;
        }
        case "remind-all": setPending({ scope: "all", label: "all launches" }); setRemindNote(null); done("Reminder offered for all launches (confirm below)", "Tap \"Set reminder\" below to subscribe to all-launch alerts at T-minus 60 and 10 minutes. Nothing is subscribed until you confirm."); break;
        case "flights-near": {
          const j = await fetch(`/api/search?q=${encodeURIComponent(intent.place)}`).then((r) => r.json()).catch(() => null);
          const hit = ((j?.data ?? []) as { type: string; label: string; lat?: number; lon?: number }[]).find((x) => x.type === "place" && x.lat != null);
          if (hit) { done(`Opening Flights centred on ${hit.label} (OpenSky)`, `Showing live flights near ${hit.label}. If OpenSky is unavailable the Flights page says so.`); setTimeout(() => navigate(`/flights?lat=${hit.lat}&lon=${hit.lon}`), NAV_DELAY_MS); }
          else done("Place not found", `I couldn't resolve "${intent.place}" to a place, so I can't centre the flight map. Try a city name like London or Tokyo.`);
          break;
        }
        case "tonight": {
          const obs = useApp.getState().observer;
          const date = new Date(simNow(useTime.getState()));
          const bodies = allBodies(date, obs);
          const sun = bodies[0];
          const visible = bodies.filter((b) => b.name !== "Sun" && b.altDeg > 0).sort((a, b) => b.altDeg - a.altDeg);
          const moon = bodies[1];
          const reply = visible.length
            ? `From ${obs.name}: ${skyCondition(sun.altDeg).toLowerCase()} skies. Above the horizon now: ${visible.map((b) => `${b.name} at ${Math.round(b.altDeg)} degrees`).join(", ")}. The Moon is ${moonPhaseName(date).name.toLowerCase()}${moon.phaseFraction != null ? `, ${Math.round(moon.phaseFraction * 100)} percent lit` : ""}${moon.altDeg > 0 ? "" : ", and below the horizon"}.`
            : `From ${obs.name}: no planets or the Moon are above the horizon right now (${skyCondition(sun.altDeg).toLowerCase()}). Try again after sunset, or ask me to find a specific planet.`;
          done("Computed from Astronomy Engine ephemeris for your observer", reply, { dataClass: "PREDICTED" });
          break;
        }
        case "time": {
          const T = useTime.getState();
          if (intent.action === "pause") { T.pause(); done("Time paused", "Time is paused. Say play, or go live, to resume."); }
          else if (intent.action === "play") { T.play(); done("Time playing", "Time is playing at real speed."); }
          else if (intent.action === "live") { T.goLive(); done("Time set to live", "Time is live."); }
          else if (intent.action === "faster") { const s = T.mode === "live" ? 10 : Math.min(86400, (T.speed || 1) * 10); T.play(s); done(`Time speed ${s}x`, `Time is now running ${s} times faster.`); }
          else { const s = Math.max(1, (T.speed || 10) / 10); if (s === 1) T.goLive(); else T.play(s); done(`Time speed ${s}x`, s === 1 ? "Time is back to real speed." : `Time slowed to ${s} times.`); }
          break;
        }
        case "layer": {
          const v = `${intent.layer}-${intent.on ? "on" : "off"}`;
          done(`${intent.on ? "Showing" : "Hiding"} ${intent.layer} layer in Sky`, `${intent.on ? "Showing" : "Hiding"} the ${intent.layer} layer.`);
          setTimeout(() => navigate(`/sky?layers=${v}`), NAV_DELAY_MS);
          break;
        }
        case "help": done("Listed example commands", "I can navigate, find planets, constellations and the ISS, open Mars rover and Moon photos, answer when the next launch is from Launch Library 2, summarise tonight's sky, control time, and toggle sky layers. Tap an example below."); break;
        case "unknown": done("No action taken", `I didn't understand "${transcript}". I can find planets and constellations, open rover photos, check the next launch, summarise tonight, and control time. Try one of the examples below.`); break;
      }
    } catch (e) { done("Command failed", `Something went wrong running that command: ${(e as Error).message}. Nothing was changed.`); }
  }, [navigate, finish]);

  const startListening = () => {
    if (listening) { recog.current?.stop(); return; }
    const r = createRecognition();
    if (!r) { setStatus("Speech recognition is not available in this browser. Typed commands below always work."); return; }
    recog.current = r; setInterim(""); setStatus(null);
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const alt = last?.[0];
      if (!alt) return;
      setInterim(alt.transcript);
      if (last.isFinal) { setListening(false); void run(alt.transcript, alt.confidence ?? null); }
    };
    r.onerror = (e) => { setListening(false); setStatus(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone permission was not granted. Nothing was recorded; typed commands below always work." : `Listening stopped (${e.error ?? "error"}). Typed commands below always work.`); };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); } catch { setStatus("Could not start listening. Typed commands below always work."); }
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-space/60 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="glass glass-strong fade-in fixed inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-y-auto rounded-b-none rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86vh] md:w-[min(680px,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl" role="dialog" aria-modal="true" aria-label="AETHERRA Voice assistant" data-testid="voice-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-starlight/20 md:hidden" aria-hidden />
        <header className="flex items-center gap-2">
          <h2 className="text-[16px] font-medium">AETHERRA Voice</h2>
          <DataBadge value="SIMULATED" size="xs" note="Assistant persona and phrasing are simulated; answers use real app data, labelled per result" />
          <button ref={closeRef} className="icon-btn ml-auto" onClick={onClose} aria-label="Close voice assistant" data-testid="voice-close">✕</button>
        </header>
        <p className="mt-1 text-[11px] leading-snug text-starlight/55">
          Push-to-talk only: there is no wake word and nothing listens until you tap the microphone. AETHERRA never receives or stores audio.
          Recognition itself runs through your browser vendor&rsquo;s speech service, which may process audio under that vendor&rsquo;s privacy policy. Typed commands always work.
        </p>

        {!support.recognition && (
          <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-3" data-testid="voice-unsupported">
            <div className="flex items-center gap-2"><DataBadge value="UNAVAILABLE" size="xs" /><span className="text-[13px] font-medium">Voice input unsupported in this browser</span></div>
            <p className="mt-1 text-[12px] text-starlight/65">This browser does not expose the Web Speech recognition API (for example, Firefox). Spoken replies {support.synthesis ? "are available" : "are also unavailable here"}. Use the typed command box below — every command works by typing.</p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${listening ? "animate-pulse border-rose-300/70 bg-rose-400/20" : "border-violet/50 bg-nebula/25 hover:bg-nebula/40"}`} onClick={startListening} disabled={!support.recognition} aria-label={listening ? "Stop listening" : "Start listening (push to talk)"} aria-pressed={listening} data-testid="voice-mic">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <div className="min-w-0 text-[12px] text-starlight/65" aria-live="polite">
            {listening ? <span className="text-rose-200">Listening… tap again to stop.</span> : support.recognition ? "Tap the microphone and speak one command." : "Microphone input unavailable here."}
            {interim && <div className="mono mt-1 truncate text-starlight" data-testid="voice-interim">“{interim}”</div>}
            {status && <div className="mt-1 text-amber-200/85">{status}</div>}
          </div>
        </div>

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { void run(typed.trim(), null); } }} data-testid="voice-typed-form">
          <input className="input min-w-0 flex-1" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder='Type a command, e.g. "Mars rover photos"' aria-label="Type a voice command" data-testid="voice-typed-input" />
          <button className="btn btn-primary shrink-0" type="submit" data-testid="voice-typed-run">Run</button>
        </form>

        {result && (
          <div className="mt-3 rounded-xl border hairline bg-black/25 p-3 text-[12px]" data-testid="voice-result" aria-live="polite">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label">Result</span>
              {result.dataClass && <DataBadge value={result.dataClass} size="xs" />}
              {result.simulated && <DataBadge value="SIMULATED" size="xs" />}
              <span className="ml-auto text-[10px] text-starlight/45">{result.speech === "spoken" ? "Reply spoken aloud" : result.speech === "muted" ? "Reply not spoken: sound is muted" : result.speech === "reduced-motion" ? "Reply not spoken: reduced motion is on" : result.speech === "disabled" ? "Reply not spoken: voice replies are off in Settings" : "Reply shown as text only"}</span>
            </div>
            <dl className="mt-2 space-y-1">
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-starlight/45">You said</dt><dd className="mono" data-testid="voice-transcript">“{result.transcript}”</dd></div>
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-starlight/45">Intent</dt><dd data-testid="voice-intent">{result.intentText}</dd></div>
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-starlight/45">Confidence</dt><dd className="mono" data-testid="voice-confidence">parser {Math.round(result.parserConfidence * 100)}%{result.asrConfidence != null ? ` · speech ${Math.round(result.asrConfidence * 100)}%` : " · typed"}</dd></div>
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-starlight/45">Action</dt><dd data-testid="voice-action">{result.action}</dd></div>
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-starlight/45">Reply</dt><dd data-testid="voice-reply">{result.reply}</dd></div>
            </dl>
            {pending && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="btn btn-primary" data-testid="voice-remind-confirm" onClick={async () => { const r = await subscribeAlerts(pending.scope, pending.target); setRemindNote(r.ok ? `Reminder set for ${pending.label} (${r.channel === "webpush" ? "browser notifications" : "in-app inbox"}; T-60 and T-10 minutes).` : `Could not set reminder: ${r.error}`); if (r.ok) setPending(null); }}>
                  Set reminder{pending.scope === "launch" ? `: ${pending.label.slice(0, 42)}` : " for all launches"}
                </button>
                <button className="btn" onClick={() => setPending(null)}>Not now</button>
              </div>
            )}
            {remindNote && <p className="mt-2 text-[11px] text-teal" role="status">{remindNote}</p>}
          </div>
        )}

        <div className="mt-3">
          <div className="label mb-1">Try saying</div>
          <div className="flex flex-wrap gap-1">
            {VOICE_SUGGESTIONS.map((s) => <button key={s} className="btn" onClick={() => { setTyped(s); void run(s, null); }} data-testid="voice-suggestion">{s}</button>)}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-starlight/40">Voice replies honour Settings (voice replies, rate, pitch), global mute and reduced motion. Full command list and privacy notes: docs/voice.md in the repo.</p>
      </section>
    </div>, document.body);
}
