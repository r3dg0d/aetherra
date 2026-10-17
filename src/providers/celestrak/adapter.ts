import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";

export const CELESTRAK_META: ProviderMetadata = registerProvider({
  id: "celestrak",
  name: "CelesTrak GP data",
  operator: "CelesTrak (T.S. Kelso)",
  homepage: "https://celestrak.org/NORAD/documentation/gp-data-formats.php",
  license: "Public; please cache and avoid re-downloading more than once per update cycle (~2h)",
  termsUrl: "https://celestrak.org/NORAD/documentation/gp-data-formats.php",
  attribution: "Orbital elements: CelesTrak (source: 18th Space Defense Squadron / space-track.org)",
  dataClass: "PREDICTED",
  expectedRefreshSeconds: 7200,
  requiresCredentials: false,
  envVars: [],
  rateLimit: "Download each GROUP at most once per 2 hours",
});

/** Groups supported by the ORBIT view. Keys are CelesTrak GROUP names. */
export const SAT_GROUPS = {
  stations: "Space stations",
  visual: "100 brightest",
  "gps-ops": "GPS operational",
  "galileo": "Galileo",
  weather: "Weather",
  noaa: "NOAA",
  science: "Science",
  starlink: "Starlink",
  "last-30-days": "Launched in last 30 days",
} as const;
export type SatGroup = keyof typeof SAT_GROUPS;

/** OMM JSON record as published by CelesTrak. */
export interface Omm {
  OBJECT_NAME: string; OBJECT_ID: string; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number;
  RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number; EPHEMERIS_TYPE: number; CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number; ELEMENT_SET_NO: number; REV_AT_EPOCH: number; BSTAR: number; MEAN_MOTION_DOT: number; MEAN_MOTION_DDOT: number;
}

export async function getGroup(group: SatGroup) {
  return cached(`celestrak:${group}`, 2 * 3600_000, async () => {
    const data = await fetchJson<Omm[] | string>(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`, { provider: CELESTRAK_META.id, timeoutMs: 30000 });
    if (!Array.isArray(data)) throw new Error(typeof data === "string" ? data.slice(0, 120) : "unexpected CelesTrak response");
    return data.filter((d) => typeof d.NORAD_CAT_ID === "number" && typeof d.MEAN_MOTION === "number");
  });
}
