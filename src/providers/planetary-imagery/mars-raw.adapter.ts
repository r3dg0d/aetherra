import "server-only";
import { fetchJson } from "../core/http";
import { cached } from "../core/cache";
import { registerProvider } from "../core/registry";
import type { ProviderMetadata } from "../core/types";
import { takeBudget } from "./budget";
import { normalizeM20, normalizeMsl, type M20Raw, type MslRaw } from "./normalize";
import { ROVERS, type RoverId } from "./targets";
import type { ImageryPage } from "./types";

const common = {
  operator: "NASA / JPL-Caltech",
  license: "NASA media guidelines: generally not copyrighted; credit NASA/JPL-Caltech (and instrument partners as stated per image)",
  termsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  dataClass: "DELAYED" as const, // raw images are published hours to days after acquisition
  expectedRefreshSeconds: 3600,
  requiresCredentials: false,
  envVars: [],
  rateLimit: "No published quota; AETHERRA caches 10 min and self-limits to 30 upstream calls / 10 min",
};

export const M20_META: ProviderMetadata = registerProvider({
  ...common, id: "mars-raw-m20", name: "Perseverance raw images",
  homepage: "https://mars.nasa.gov/mars2020/multimedia/raw-images/",
  attribution: "Raw images: NASA/JPL-Caltech (Mars 2020 Perseverance)",
});
export const MSL_META: ProviderMetadata = registerProvider({
  ...common, id: "mars-raw-msl", name: "Curiosity raw images",
  homepage: "https://mars.nasa.gov/msl/multimedia/raw-images/",
  attribution: "Raw images: NASA/JPL-Caltech (MSL Curiosity), with instrument partners as credited",
});

const TTL = 10 * 60_000;
const PER_PAGE = 48;

async function m20(sol: number | null, camera: string | null): Promise<ImageryPage> {
  const p = new URLSearchParams({ feed: "raw_images", category: "mars2020", feedtype: "json", num: String(PER_PAGE), page: "0", order: "sol desc" });
  if (sol != null) p.set("sol", String(sol));
  if (camera) p.set("search", camera);
  takeBudget(M20_META.id, 30, 10 * 60_000);
  const r = await fetchJson<{ images?: M20Raw[]; total_results?: number }>(`https://mars.nasa.gov/rss/api/?${p}`, { provider: M20_META.id, timeoutMs: 25000, retries: 1 });
  if (!Array.isArray(r.images)) throw new Error("unexpected Perseverance feed shape");
  const items = r.images.filter((i) => !camera || i.camera?.instrument === camera).map(normalizeM20).filter((x) => x != null);
  return { items: sol == null ? items : items.filter((i) => i.sol === sol), total: r.total_results ?? null };
}

async function msl(sol: number | null, camera: string | null): Promise<ImageryPage> {
  const p = new URLSearchParams({ order: "sol desc,date_taken desc", per_page: String(PER_PAGE), page: "0", condition_1: "msl:mission" });
  if (sol != null) { p.set("condition_2", `${sol}:sol:gte`); p.set("condition_3", `${sol}:sol:lte`); }
  if (camera) p.set("search", camera);
  takeBudget(MSL_META.id, 30, 10 * 60_000);
  const r = await fetchJson<{ items?: MslRaw[]; total?: number }>(`https://mars.nasa.gov/api/v1/raw_image_items/?${p}`, { provider: MSL_META.id, timeoutMs: 25000, retries: 1 });
  if (!Array.isArray(r.items)) throw new Error("unexpected Curiosity feed shape");
  const items = r.items.filter((i) => !camera || i.instrument === camera).map(normalizeMsl).filter((x) => x != null);
  return { items, total: r.total ?? null };
}

/** Raw images for one rover. Without a sol, lists the latest sol that has images (for the camera filter, if any). */
export async function getRoverImages(rover: RoverId, opts: { sol?: number | null; camera?: string | null }) {
  const camera = opts.camera && ROVERS[rover].cameras.some((c) => c.id === opts.camera) ? opts.camera : null;
  const sol = opts.sol ?? null;
  const fetcher = rover === "perseverance" ? m20 : msl;
  return cached(`mars-raw:${rover}:${sol ?? "latest"}:${camera ?? "all"}`, TTL, async () => {
    if (sol != null) {
      const page = await fetcher(sol, camera);
      return { ...page, sol };
    }
    const newest = await fetcher(null, camera);
    const latest = newest.items[0]?.sol ?? null;
    return { items: newest.items.filter((i) => i.sol === latest), total: newest.total, sol: latest, latestSol: latest };
  });
}

export const roverMeta = (rover: RoverId) => (rover === "perseverance" ? M20_META : MSL_META);
