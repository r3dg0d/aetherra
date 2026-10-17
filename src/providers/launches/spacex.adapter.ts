import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";
import type { NormalizedLaunch } from "./types";

/**
 * SpaceX official-source adapter.
 * SpaceX does not offer a public schedule API. The community "r/SpaceX API" is unofficial and has not been
 * maintained since 2022, so it is intentionally NOT used as a schedule source. This adapter links to
 * official SpaceX pages for SpaceX-operated launches found in LL2.
 */
export const SPACEX_META: ProviderMetadata = registerProvider({
  id: "spacex-official",
  name: "SpaceX official pages (links only)",
  operator: "SpaceX",
  homepage: "https://www.spacex.com/launches/",
  license: "SpaceX website terms",
  attribution: "Mission links: SpaceX (spacex.com). Schedule data via Launch Library 2.",
  dataClass: "LIVE",
  expectedRefreshSeconds: 3600,
  requiresCredentials: false,
  envVars: [],
}, () => false);

export const SPACEX_OFFICIAL = { launches: "https://www.spacex.com/launches/", x: "https://x.com/SpaceX" };

export function isSpaceXOperated(l: Pick<NormalizedLaunch, "operatorName">) {
  return /space exploration technologies|spacex/i.test(l.operatorName ?? "");
}
