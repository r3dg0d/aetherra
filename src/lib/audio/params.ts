/** Pure sound-design parameters (unit-tested). Sound is cinematic, not a model of space acoustics. */
export type Scene = "home" | "sky" | "earth" | "orbit" | "flights" | "launches" | "ascent" | "status";

export interface DroneParams { root: number; ratios: number[]; cutoff: number; lfoHz: number; noise: number; level: number }

export const DRONES: Record<Scene, DroneParams> = {
  home: { root: 55, ratios: [1, 1.5, 2.0, 3.0], cutoff: 520, lfoHz: 0.05, noise: 0.05, level: 0.16 },
  sky: { root: 65.41, ratios: [1, 1.498, 2.52, 3.0], cutoff: 900, lfoHz: 0.03, noise: 0.02, level: 0.13 },
  earth: { root: 49, ratios: [1, 1.5, 2.0], cutoff: 420, lfoHz: 0.04, noise: 0.08, level: 0.14 },
  orbit: { root: 58.27, ratios: [1, 1.335, 2.0, 2.67], cutoff: 700, lfoHz: 0.06, noise: 0.03, level: 0.14 },
  flights: { root: 73.42, ratios: [1, 1.5, 2.0], cutoff: 480, lfoHz: 0.08, noise: 0.1, level: 0.11 },
  launches: { root: 61.74, ratios: [1, 1.26, 1.5, 2.0], cutoff: 600, lfoHz: 0.07, noise: 0.04, level: 0.12 },
  ascent: { root: 41.2, ratios: [1, 1.5, 2.0], cutoff: 360, lfoHz: 0.05, noise: 0.06, level: 0.1 },
  status: { root: 55, ratios: [1, 1.5], cutoff: 300, lfoHz: 0.04, noise: 0.0, level: 0.06 },
};

/**
 * Engine rumble mapping. `densityFrac` is ambient air density / sea level (0 in vacuum).
 * Loudness follows throttle and fades with altitude (cinematic, not physical: real exhaust is silent in vacuum
 * to a distant observer). Dynamic pressure brightens and roughens the sound.
 */
export function engineParams(throttle: number, qPa: number, densityFrac: number) {
  const t = Math.max(0, Math.min(1, throttle));
  const qn = Math.max(0, Math.min(1, qPa / 35_000));
  const air = Math.max(0, Math.min(1, densityFrac));
  const gain = t * (0.18 + 0.82 * Math.sqrt(air)) * 0.9;
  const cutoff = 140 + 900 * t * (0.3 + 0.7 * air) + 2200 * qn;
  const rumbleHz = 32 + 14 * t;
  const buffet = qn * t; // tremolo depth from aerodynamic buffeting
  return { gain, cutoff, rumbleHz, buffet };
}

/** Countdown beep pitch: higher for the final three seconds. */
export function beepHz(secondsLeft: number) { return secondsLeft <= 3 ? 1320 : 880; }
