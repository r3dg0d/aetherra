export type StarRow = [hip: number, ra: number, dec: number, mag: number, bv: number | null, name: string, bayer: string, flam: string, con: string];
export interface StarCatalog { source: string; fields: string[]; stars: StarRow[] }
export interface Constellation { id: string; name: string; gen: string; rank: number; label: [number, number]; lines: [number, number][][] }

let starsP: Promise<StarCatalog> | null = null;
let consP: Promise<{ constellations: Constellation[] }> | null = null;
export const loadStars = (): Promise<StarCatalog> => (starsP ??= fetch("/data/stars.json").then((r) => r.json()));
export const loadConstellations = (): Promise<{ constellations: Constellation[] }> => (consP ??= fetch("/data/constellations.json").then((r) => r.json()));

/** Approximate star colour from B−V index (Ballesteros 2012 temperature → blackbody RGB approximation). */
export function bvToRgb(bv: number | null): [number, number, number] {
  if (bv == null) return [1, 1, 1];
  const b = Math.max(-0.4, Math.min(2.0, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const k = t / 100;
  let r: number, g: number, bl: number;
  if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; bl = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04; }
  else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); bl = 255; }
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(bl)];
}

export function bvToTemperatureK(bv: number | null) {
  if (bv == null) return null;
  return Math.round(4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)));
}

export function starLabel(s: StarRow) {
  const [hip, , , , , name, bayer, flam, con] = s;
  if (name) return name;
  if (bayer) return `${bayer} ${con}`;
  if (flam) return `${flam} ${con}`;
  return `HIP ${hip}`;
}
