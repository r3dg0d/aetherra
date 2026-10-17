"use client";
import { create } from "zustand";
import type { DataClass } from "@/lib/classification";

/** Simulation clock. simTime = anchorSim + (now − anchorReal) × speed (when playing). */
interface TimeState {
  mode: "live" | "playing" | "paused";
  speed: number;
  anchorSim: number;
  anchorReal: number;
  goLive: () => void;
  pause: () => void;
  play: (speed?: number) => void;
  setSpeed: (speed: number) => void;
  setTime: (ms: number) => void;
  step: (deltaMs: number) => void;
}

export const useTime = create<TimeState>((set, get) => ({
  mode: "live", speed: 1, anchorSim: Date.now(), anchorReal: Date.now(),
  goLive: () => set({ mode: "live", speed: 1, anchorSim: Date.now(), anchorReal: Date.now() }),
  pause: () => set({ mode: "paused", anchorSim: simNow(get()), anchorReal: Date.now() }),
  play: (speed) => set((s) => ({ mode: "playing", speed: speed ?? (s.speed || 1), anchorSim: simNow(s), anchorReal: Date.now() })),
  setSpeed: (speed) => set((s) => ({ speed, mode: s.mode === "live" && speed !== 1 ? "playing" : s.mode === "live" ? "live" : s.mode, anchorSim: simNow(s), anchorReal: Date.now() })),
  setTime: (ms) => set((s) => ({ mode: s.mode === "live" ? "paused" : s.mode, anchorSim: ms, anchorReal: Date.now() })),
  step: (d) => set((s) => ({ mode: s.mode === "live" ? "paused" : s.mode, anchorSim: simNow(s) + d, anchorReal: Date.now() })),
}));

export function simNow(s: Pick<TimeState, "mode" | "speed" | "anchorSim" | "anchorReal">, real = Date.now()) {
  if (s.mode === "live") return real;
  if (s.mode === "paused") return s.anchorSim;
  return s.anchorSim + (real - s.anchorReal) * s.speed;
}

export function getSimDate() {
  return new Date(simNow(useTime.getState()));
}

/** Classification of computed sky/orbit positions for the current clock. */
export function timeClass(simMs: number, mode: TimeState["mode"], real = Date.now()): DataClass {
  if (mode === "live" || Math.abs(simMs - real) < 120_000) return "LIVE";
  return simMs < real ? "HISTORICAL" : "PREDICTED";
}
