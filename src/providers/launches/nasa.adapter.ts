import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";
import type { NormalizedLaunch } from "./types";

/**
 * NASA schedule source adapter.
 * NASA does not publish a stable machine-readable launch schedule API. This adapter therefore does not
 * scrape; it identifies NASA-involved launches inside the LL2 dataset and links to NASA's official pages.
 * Status is reported honestly as "derived" rather than as an independent live feed.
 */
export const NASA_META: ProviderMetadata = registerProvider({
  id: "nasa-schedule",
  name: "NASA launch schedule (derived)",
  operator: "NASA",
  homepage: "https://www.nasa.gov/event-type/launch-schedule/",
  license: "NASA media/usage guidelines",
  termsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  attribution: "Mission links: NASA (nasa.gov). Schedule data via Launch Library 2.",
  dataClass: "LIVE",
  expectedRefreshSeconds: 3600,
  requiresCredentials: false,
  envVars: [],
}, () => false);

export const NASA_OFFICIAL = {
  schedule: "https://www.nasa.gov/event-type/launch-schedule/",
  nasaPlus: "https://plus.nasa.gov/",
  youtube: "https://www.youtube.com/@NASA",
};

export function isNasaInvolved(l: Pick<NormalizedLaunch, "operatorName" | "customers" | "name">) {
  const re = /\bNASA\b|National Aeronautics and Space Administration/i;
  return re.test(l.operatorName ?? "") || l.customers.some((c) => re.test(c)) || /\bArtemis\b/i.test(l.name);
}
