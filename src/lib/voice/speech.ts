"use client";
/**
 * Web Speech API wrapper. Recognition is created ONLY inside startListening(), which is called from a
 * user tap — never on mount, so no microphone permission prompt appears unprompted.
 * AETHERRA sends no audio anywhere: recognition runs through the browser vendor's service
 * (per that vendor's privacy policy), synthesis is local. See docs/voice.md.
 */
export interface SpeechSupport { recognition: boolean; synthesis: boolean }
type RecogCtor = new () => SpeechRecognitionLike;
export interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
export interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal: boolean }>;
}

export function speechSupport(): SpeechSupport {
  if (typeof window === "undefined") return { recognition: false, synthesis: false };
  const w = window as unknown as Record<string, unknown>;
  return { recognition: !!(w.SpeechRecognition || w.webkitSpeechRecognition), synthesis: "speechSynthesis" in window };
}

export function createRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as RecogCtor | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-US"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  return r;
}

export interface SpeakOptions { enabled: boolean; muted: boolean; reducedMotion: boolean; rate: number; pitch: number }

/** Speak a reply if settings allow. Returns what happened for honest UI display. */
export function speak(text: string, o: SpeakOptions): "spoken" | "muted" | "disabled" | "unsupported" | "reduced-motion" {
  if (!o.enabled) return "disabled";
  if (o.muted) return "muted";
  if (o.reducedMotion) return "reduced-motion";
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "unsupported";
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.min(1.5, Math.max(0.6, o.rate)); u.pitch = Math.min(1.6, Math.max(0.5, o.pitch));
    window.speechSynthesis.speak(u);
    (window as unknown as { __aetherraLastSpoken?: string }).__aetherraLastSpoken = text;
    return "spoken";
  } catch { return "unsupported"; }
}

export function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch {} }
