"use client";
import { create } from "zustand";
import { useApp, type Quality } from "@/lib/store/app";

export type Tier = "low" | "medium" | "high" | "ultra";
export const TIERS: Tier[] = ["low", "medium", "high", "ultra"];

export interface TierSettings {
  tier: Tier;
  /** Device-pixel-ratio range used by dynamic resolution. */
  dpr: [number, number];
  textures: "2k" | "4k";
  clouds: "1k" | "2k" | null;
  bloom: boolean;
  antialias: boolean;
  starMag: number;
  segments: number;
  milkyWay: boolean;
  particles: number;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  low: { tier: "low", dpr: [0.6, 1], textures: "2k", clouds: null, bloom: false, antialias: false, starMag: 5, segments: 80, milkyWay: false, particles: 120 },
  medium: { tier: "medium", dpr: [0.8, 1.5], textures: "2k", clouds: "1k", bloom: true, antialias: true, starMag: 6, segments: 128, milkyWay: true, particles: 400 },
  high: { tier: "high", dpr: [1, 2], textures: "4k", clouds: "2k", bloom: true, antialias: true, starMag: 6, segments: 192, milkyWay: true, particles: 900 },
  ultra: { tier: "ultra", dpr: [1.25, 2.5], textures: "4k", clouds: "2k", bloom: true, antialias: true, starMag: 6.5, segments: 256, milkyWay: true, particles: 1800 },
};

/** Initial guess for Auto: phones and low-core devices start at Low, others at Medium; the monitor adapts from there. */
export function initialAutoTier(): Tier {
  if (typeof navigator === "undefined") return "medium";
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (mobile || cores <= 4) return "low";
  return "medium";
}

/** Runtime performance telemetry and the Auto tier (not persisted). */
interface PerfState {
  autoTier: Tier;
  dpr: number;
  fps: number;
  frameMs: { p50: number; p95: number };
  calls: number;
  triangles: number;
  setAutoTier: (t: Tier) => void;
  setDpr: (d: number) => void;
  setStats: (s: Partial<Pick<PerfState, "fps" | "frameMs" | "calls" | "triangles">>) => void;
}
export const usePerf = create<PerfState>((set) => ({
  autoTier: initialAutoTier(), dpr: 1, fps: 0, frameMs: { p50: 0, p95: 0 }, calls: 0, triangles: 0,
  setAutoTier: (autoTier) => set({ autoTier }), setDpr: (dpr) => set({ dpr }), setStats: (s) => set(s),
}));

export function resolveTier(q: Quality, auto: Tier): Tier { return q === "auto" ? auto : q; }

/** Effective settings for the selected quality (Auto resolves to the adaptive tier). */
export function useQuality(): TierSettings & { auto: boolean } {
  const q = useApp((s) => s.quality);
  const auto = usePerf((s) => s.autoTier);
  return { ...TIER_SETTINGS[resolveTier(q, auto)], auto: q === "auto" };
}
