"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DataClass } from "@/lib/classification";
import type { ObserverLoc } from "@/lib/astro/sky";

export const OBSERVER_PRESETS: ObserverLoc[] = [
  { name: "Greenwich, UK", lat: 51.4769, lon: -0.0005, heightM: 46 },
  { name: "Kennedy Space Center, FL", lat: 28.5729, lon: -80.649, heightM: 3 },
  { name: "Mauna Kea, HI", lat: 19.8207, lon: -155.4681, heightM: 4207 },
  { name: "Atacama (ALMA), Chile", lat: -23.0193, lon: -67.7532, heightM: 5058 },
  { name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437, heightM: 89 },
  { name: "New York, NY", lat: 40.7128, lon: -74.006, heightM: 10 },
  { name: "Tokyo, Japan", lat: 35.6762, lon: 139.6503, heightM: 40 },
  { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093, heightM: 58 },
  { name: "Reykjavík, Iceland", lat: 64.1466, lon: -21.9426, heightM: 20 },
  { name: "Nairobi, Kenya", lat: -1.2921, lon: 36.8219, heightM: 1795 },
];

export type Quality = "low" | "medium" | "high" | "ultra" | "auto";

interface AppState {
  observer: ObserverLoc;
  setObserver: (o: ObserverLoc) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  showPerf: boolean;
  togglePerf: () => void;
  clientId: string | null;
  ensureClientId: () => string;
  /** Sound: muted by default; audio only starts after a user gesture (autoplay policy). */
  muted: boolean;
  setMuted: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  ambient: boolean;
  setAmbient: (v: boolean) => void;
  uiSounds: boolean;
  setUiSounds: (v: boolean) => void;
  /** Static NASA Blue Marble cloud composite (illustrative, not live weather). */
  showClouds: boolean;
  setShowClouds: (v: boolean) => void;
}

export const useApp = create<AppState>()(persist((set, get) => ({
  observer: OBSERVER_PRESETS[0],
  setObserver: (observer) => set({ observer }),
  quality: "auto",
  setQuality: (quality) => set({ quality }),
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  showPerf: false,
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  muted: true,
  setMuted: (muted) => set({ muted }),
  volume: 0.6,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  ambient: true,
  setAmbient: (ambient) => set({ ambient }),
  uiSounds: true,
  setUiSounds: (uiSounds) => set({ uiSounds }),
  showClouds: true,
  setShowClouds: (showClouds) => set({ showClouds }),
  clientId: null,
  ensureClientId: () => {
    const c = get().clientId;
    if (c) return c;
    const id = crypto.randomUUID();
    set({ clientId: id });
    return id;
  },
}), {
  name: "aetherra-app", version: 2, skipHydration: true,
  migrate: (persisted, version) => {
    const p = (persisted ?? {}) as Partial<AppState>;
    if (version < 2) return { ...p, quality: "auto", muted: true, volume: 0.6, ambient: true, uiSounds: true, showClouds: true } as AppState;
    return p as AppState;
  },
}));

/** Live view telemetry shown in the bottom bar. Not persisted. */
interface ViewState {
  dataClass: DataClass;
  dataNote: string;
  cursor: { lat: number; lon: number } | null;
  camera: { lat: number; lon: number; altKm: number; distanceKm: number } | null;
  setData: (c: DataClass, note?: string) => void;
  setCamera: (c: ViewState["camera"]) => void;
  setCursor: (c: ViewState["cursor"]) => void;
  /** Screenshot mode: hides all chrome (H key or the eye button). */
  hideUi: boolean;
  setHideUi: (v: boolean) => void;
}

export const useView = create<ViewState>((set) => ({
  dataClass: "LIVE", dataNote: "", cursor: null, camera: null,
  setData: (dataClass, dataNote = "") => set({ dataClass, dataNote }),
  setCamera: (camera) => set({ camera }),
  setCursor: (cursor) => set({ cursor }),
  hideUi: false,
  setHideUi: (hideUi) => set({ hideUi }),
}));
