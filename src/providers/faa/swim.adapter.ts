import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";

/**
 * FAA SWIM (System Wide Information Management) adapter.
 * SWIM feeds (SFDPS, TFMS, STDDS) require an approved FAA NSRR account and a JMS/Solace connection.
 * Without configuration this adapter reports UNAVAILABLE; it never fabricates data.
 */
export const FAA_SWIM_META: ProviderMetadata = registerProvider({
  id: "faa-swim",
  name: "FAA SWIM (SCDS)",
  operator: "Federal Aviation Administration",
  homepage: "https://www.faa.gov/air_traffic/technology/swim",
  license: "Requires FAA SWIM Cloud Distribution Service account and approval",
  termsUrl: "https://scds.swim.faa.gov/",
  attribution: "FAA SWIM",
  dataClass: "LIVE",
  expectedRefreshSeconds: 12,
  requiresCredentials: true,
  envVars: ["FAA_SWIM_JMS_URL", "FAA_SWIM_USERNAME", "FAA_SWIM_PASSWORD", "FAA_SWIM_QUEUE"],
}, () => isSwimConfigured());

export function isSwimConfigured() {
  return !!(process.env.FAA_SWIM_JMS_URL && process.env.FAA_SWIM_USERNAME && process.env.FAA_SWIM_PASSWORD && process.env.FAA_SWIM_QUEUE);
}

export function swimStatus() {
  if (!isSwimConfigured()) {
    return { dataClass: "UNAVAILABLE" as const, configured: false, notice: "FAA SWIM is not configured. It requires an approved SCDS subscription (set FAA_SWIM_* env vars)." };
  }
  return { dataClass: "UNAVAILABLE" as const, configured: true, notice: "SWIM credentials present, but the Solace JMS consumer is not implemented in this build. See docs/providers.md." };
}
