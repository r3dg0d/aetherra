import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";

export const NOMINATIM_META = registerProvider({
  id: "nominatim", name: "Nominatim geocoder", operator: "OpenStreetMap Foundation", homepage: "https://nominatim.org/",
  license: "ODbL; max 1 request/s, results cached", termsUrl: "https://operations.osmfoundation.org/policies/nominatim/",
  attribution: "Geocoding © OpenStreetMap contributors", dataClass: "HISTORICAL", expectedRefreshSeconds: 86400 * 30,
  requiresCredentials: false, envVars: ["NOMINATIM_URL"], rateLimit: "1 request/second",
});

let last = 0;
export async function geocode(q: string) {
  const key = `nominatim:${q.toLowerCase().trim()}`;
  return cached(key, 7 * 86400_000, async () => {
    const wait = 1100 - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const base = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
    const r = await fetchJson<{ display_name: string; lat: string; lon: string; type: string; class: string }[]>(`${base}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, { provider: NOMINATIM_META.id, retries: 0, timeoutMs: 8000 });
    return r.map((p) => ({ name: p.display_name, lat: +p.lat, lon: +p.lon, kind: `${p.class}:${p.type}` }));
  });
}
