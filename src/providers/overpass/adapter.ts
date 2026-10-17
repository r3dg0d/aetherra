import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";

export const OVERPASS_META: ProviderMetadata = registerProvider({
  id: "overpass",
  name: "OpenStreetMap Overpass API",
  operator: "OpenStreetMap contributors / Overpass API operators",
  homepage: "https://wiki.openstreetmap.org/wiki/Overpass_API",
  license: "ODbL 1.0",
  termsUrl: "https://www.openstreetmap.org/copyright",
  attribution: "© OpenStreetMap contributors (ODbL)",
  dataClass: "HISTORICAL",
  expectedRefreshSeconds: 86400,
  requiresCredentials: false,
  envVars: ["OVERPASS_URL"],
  rateLimit: "Fair use; queries limited to small areas and cached 24 h",
});

/** Streetlights (highway=street_lamp) in a small bbox. Area capped to ~0.05 sq deg to respect fair use. */
export async function getStreetlights(b: { s: number; w: number; n: number; e: number }) {
  const round = (v: number) => Math.round(v * 100) / 100;
  const bb = { s: round(b.s), w: round(b.w), n: round(b.n), e: round(b.e) };
  if ((bb.n - bb.s) * (bb.e - bb.w) > 0.05 || bb.n <= bb.s || bb.e <= bb.w) throw new Error("bbox too large (max 0.05 square degrees)");
  return cached(`overpass:lamps:${bb.s},${bb.w},${bb.n},${bb.e}`, 24 * 3600_000, async () => {
    const q = `[out:json][timeout:25];node["highway"="street_lamp"](${bb.s},${bb.w},${bb.n},${bb.e});out 5000;`;
    const j = await fetchJson<{ elements: { id: number; lat: number; lon: number; tags?: Record<string, string> }[] }>(process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter", {
      provider: OVERPASS_META.id, method: "POST", body: new URLSearchParams({ data: q }).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeoutMs: 30000, retries: 0,
    });
    return j.elements.map((e) => ({ id: e.id, lat: e.lat, lon: e.lon, lampType: e.tags?.["lamp_type"] ?? e.tags?.["light:method"] ?? null }));
  });
}
