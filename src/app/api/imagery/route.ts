import { json, bad } from "@/server/http";
import { envelope } from "@/providers/core/envelope";
import { ProviderError } from "@/providers/core/types";
import { getRoverImages, roverMeta } from "@/providers/planetary-imagery/mars-raw.adapter";
import { getArchiveImages, IVL_META } from "@/providers/planetary-imagery/nasa-ivl.adapter";
import { ROVERS, targetById, type RoverId } from "@/providers/planetary-imagery/targets";
import type { ImageryPage } from "@/providers/planetary-imagery/types";

/**
 * Planetary imagery.
 *   ?target=mars&source=rover&rover=perseverance|curiosity[&camera=NAVCAM_LEFT][&sol=2011]   raw rover images (DELAYED)
 *   ?target=<id>&source=archive[&q=<query id>][&page=1]                                       NASA Image and Video Library (HISTORICAL)
 * Parameters are allowlisted; nothing user-typed is forwarded upstream verbatim.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const target = targetById(sp.get("target"));
  if (!target) return bad("unknown target");
  const source = sp.get("source") ?? (target.rover ? "rover" : "archive");
  const empty: ImageryPage = { items: [], total: 0 };

  if (source === "rover") {
    if (!target.rover) return bad("rover images exist only for mars");
    const rover = (sp.get("rover") ?? "perseverance") as RoverId;
    if (!(rover in ROVERS)) return bad("rover must be perseverance or curiosity");
    const solRaw = sp.get("sol");
    const sol = solRaw && solRaw !== "latest" ? Number(solRaw) : null;
    if (sol != null && (!Number.isInteger(sol) || sol < 0 || sol > 20000)) return bad("sol must be an integer 0–20000");
    const meta = roverMeta(rover);
    try {
      const r = await getRoverImages(rover, { sol, camera: sp.get("camera") });
      return json(envelope(meta, r.value, r.fetchedAt, { stale: r.stale, notice: r.stale ? `Upstream refresh failed (${r.error}); showing cached images` : undefined }), { maxAge: 300 });
    } catch (e) {
      return json(envelope(meta, empty, null, { dataClass: "UNAVAILABLE", notice: `${meta.name} unavailable: ${(e as Error).message}` }), { status: e instanceof ProviderError && e.status === 429 ? 503 : 502, headers: retryAfter(e) });
    }
  }
  if (source !== "archive") return bad("source must be rover or archive");
  const page = Math.max(1, Math.min(20, Number(sp.get("page")) || 1));
  try {
    const r = await getArchiveImages(target, sp.get("q"), page);
    return json(envelope(IVL_META, r.value, r.fetchedAt, { stale: r.stale, notice: r.stale ? `Upstream refresh failed (${r.error}); showing cached results` : undefined }), { maxAge: 3600 });
  } catch (e) {
    return json(envelope(IVL_META, empty, null, { dataClass: "UNAVAILABLE", notice: `NASA Image and Video Library unavailable: ${(e as Error).message}` }), { status: 502, headers: retryAfter(e) });
  }
}

function retryAfter(e: unknown): Record<string, string> | undefined {
  return e instanceof ProviderError && e.retryAfterSeconds ? { "Retry-After": String(e.retryAfterSeconds) } : undefined;
}
