import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";

export const OPENSKY_META: ProviderMetadata = registerProvider({
  id: "opensky",
  name: "OpenSky Network state vectors",
  operator: "The OpenSky Network",
  homepage: "https://opensky-network.org/",
  license: "Non-commercial research/education use; see OpenSky terms",
  termsUrl: "https://opensky-network.org/about/terms-of-use",
  attribution: "Flight data: The OpenSky Network, https://opensky-network.org",
  dataClass: "DELAYED",
  expectedRefreshSeconds: 15,
  requiresCredentials: false,
  envVars: ["OPENSKY_CLIENT_ID", "OPENSKY_CLIENT_SECRET"],
  rateLimit: "Anonymous: 400 credits/day, 10 s resolution; authenticated: 4000+ credits/day",
});

export interface Aircraft {
  icao24: string; callsign: string | null; originCountry: string; timePosition: number | null; lastContact: number;
  lon: number; lat: number; baroAltitude: number | null; onGround: boolean; velocity: number | null; trueTrack: number | null;
  verticalRate: number | null; geoAltitude: number | null; squawk: string | null; category: number | null;
}

const g = globalThis as unknown as { __openskyToken?: { token: string; exp: number } };

async function token(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID, secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (g.__openskyToken && g.__openskyToken.exp > Date.now() + 30_000) return g.__openskyToken.token;
  const res = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`OpenSky OAuth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  g.__openskyToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export function authMode() {
  return process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET ? "oauth" : "anonymous";
}

/** Bounding box is rounded to 1° to share cache entries; anonymous requests are cached for 15 s. */
export async function getStates(bbox: { lamin: number; lomin: number; lamax: number; lomax: number }) {
  const r = (v: number, f: (x: number) => number) => f(v);
  const b = { lamin: r(bbox.lamin, Math.floor), lomin: r(bbox.lomin, Math.floor), lamax: r(bbox.lamax, Math.ceil), lomax: r(bbox.lomax, Math.ceil) };
  const key = `opensky:${b.lamin},${b.lomin},${b.lamax},${b.lomax}`;
  return cached(key, authMode() === "oauth" ? 6_000 : 15_000, async () => {
    const t = await token();
    const url = `https://opensky-network.org/api/states/all?lamin=${b.lamin}&lomin=${b.lomin}&lamax=${b.lamax}&lomax=${b.lomax}&extended=1`;
    const j = await fetchJson<{ time: number; states: unknown[][] | null }>(url, { provider: OPENSKY_META.id, headers: t ? { Authorization: `Bearer ${t}` } : {}, retries: 0, timeoutMs: 20000 });
    const states: Aircraft[] = (j.states ?? []).flatMap((s) => {
      if (typeof s[5] !== "number" || typeof s[6] !== "number") return [];
      return [{
        icao24: String(s[0]), callsign: s[1] ? String(s[1]).trim() || null : null, originCountry: String(s[2]), timePosition: (s[3] as number) ?? null,
        lastContact: s[4] as number, lon: s[5] as number, lat: s[6] as number, baroAltitude: (s[7] as number) ?? null, onGround: !!s[8],
        velocity: (s[9] as number) ?? null, trueTrack: (s[10] as number) ?? null, verticalRate: (s[11] as number) ?? null,
        geoAltitude: (s[13] as number) ?? null, squawk: (s[14] as string) ?? null, category: (s[17] as number) ?? null,
      }];
    });
    return { time: j.time, states, bbox: b };
  });
}
