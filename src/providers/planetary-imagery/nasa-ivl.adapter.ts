import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";
import { takeBudget } from "./budget";
import { normalizeIvl, type IvlItem } from "./normalize";
import type { ImageryTarget } from "./targets";
import type { ImageryPage } from "./types";

export const IVL_META: ProviderMetadata = registerProvider({
  id: "nasa-ivl",
  name: "NASA Image and Video Library",
  operator: "NASA",
  homepage: "https://images.nasa.gov",
  license: "NASA media guidelines: generally not copyrighted; some items carry third-party rights noted in their metadata",
  termsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  attribution: "Images: NASA Image and Video Library (images.nasa.gov); per-item credit shown",
  dataClass: "HISTORICAL",
  expectedRefreshSeconds: 86400,
  requiresCredentials: false,
  envVars: [],
  rateLimit: "No key or published quota; AETHERRA caches 24 h and self-limits to 60 upstream calls / 10 min",
});

/** Search the library for one curated mission query of a target. */
export async function getArchiveImages(target: ImageryTarget, queryId: string | null, page = 1) {
  const q = target.queries.find((x) => x.id === queryId) ?? target.queries[0];
  return cached(`nasa-ivl:${target.id}:${q.id}:${page}`, 24 * 3600_000, async (): Promise<ImageryPage> => {
    const p = new URLSearchParams({ q: q.q, media_type: "image", page_size: "48", page: String(page) });
    takeBudget(IVL_META.id, 60, 10 * 60_000);
    const r = await fetchJson<{ collection?: { items?: IvlItem[]; metadata?: { total_hits?: number } } }>(`https://images-api.nasa.gov/search?${p}`, { provider: IVL_META.id, timeoutMs: 20000 });
    const items = r.collection?.items;
    if (!Array.isArray(items)) throw new Error("unexpected NASA library response shape");
    const seen = new Set<string>();
    const out = items.map((i) => normalizeIvl(i, target.id, q.label)).filter((x) => x != null).filter((x) => !seen.has(x.id) && !!seen.add(x.id));
    return { items: out, total: r.collection?.metadata?.total_hits ?? null, query: q.id };
  });
}
