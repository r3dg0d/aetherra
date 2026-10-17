import { fetchJson } from "../core/http";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";
import { normalizeLl2 } from "./normalize";
import type { NormalizedLaunch } from "./types";

export const LL2_META: ProviderMetadata = registerProvider({
  id: "ll2",
  name: "Launch Library 2",
  operator: "The Space Devs",
  homepage: "https://thespacedevs.com/llapi",
  license: "Free tier for non-commercial use; see The Space Devs terms",
  termsUrl: "https://thespacedevs.com/llapi",
  attribution: "Launch data: Launch Library 2 by The Space Devs",
  dataClass: "LIVE",
  expectedRefreshSeconds: 900,
  requiresCredentials: false,
  envVars: ["LL2_BASE_URL", "LL2_API_TOKEN", "LL2_MAX_REQUESTS_PER_HOUR"],
  rateLimit: "15 requests/hour without a token",
});

export function ll2BaseUrl() {
  if (process.env.LL2_BASE_URL) return process.env.LL2_BASE_URL.replace(/\/$/, "");
  // lldev serves cached data without the strict quota and is intended for development.
  return process.env.NODE_ENV === "production" ? "https://ll.thespacedevs.com/2.3.0" : "https://lldev.thespacedevs.com/2.3.0";
}

export function ll2HourlyBudget() {
  const env = Number(process.env.LL2_MAX_REQUESTS_PER_HOUR);
  if (Number.isFinite(env) && env > 0) return env;
  if (process.env.LL2_API_TOKEN) return 200;
  return ll2BaseUrl().includes("lldev") ? 60 : 12; // keep headroom under the 15/h free tier
}

function headers(): Record<string, string> {
  return process.env.LL2_API_TOKEN ? { Authorization: `Token ${process.env.LL2_API_TOKEN}` } : {};
}

interface Page { count: number; results: unknown[] }

export async function fetchLl2List(kind: "upcoming" | "previous", limit = 40): Promise<{ launches: NormalizedLaunch[]; rejected: number; count: number }> {
  const url = `${ll2BaseUrl()}/launches/${kind}/?limit=${limit}&mode=detailed${kind === "upcoming" ? "&hide_recent_previous=true" : ""}`;
  const page = await fetchJson<Page>(url, { provider: LL2_META.id, headers: headers(), timeoutMs: 30000, retries: 1 });
  if (!page || !Array.isArray(page.results)) throw new Error("LL2 response missing results");
  const launches: NormalizedLaunch[] = [];
  let rejected = 0;
  for (const r of page.results) {
    const n = normalizeLl2(r);
    if (n) launches.push(n);
    else rejected++;
  }
  return { launches, rejected, count: page.count };
}

export async function fetchLl2Launch(id: string): Promise<NormalizedLaunch | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const raw = await fetchJson<unknown>(`${ll2BaseUrl()}/launches/${id}/?mode=detailed`, { provider: LL2_META.id, headers: headers(), retries: 1 });
  return normalizeLl2(raw);
}
