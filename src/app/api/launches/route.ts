import { json, bad } from "@/server/http";
import { listLaunches } from "@/providers/launches/service";
import { LL2_META } from "@/providers/launches/ll2.adapter";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const window = (sp.get("window") ?? "upcoming") as "upcoming" | "previous";
  if (!["upcoming", "previous"].includes(window)) return bad("window must be upcoming|previous");
  try {
    const { launches, status } = await listLaunches({ window, operator: sp.get("operator") ?? undefined, q: sp.get("q") ?? undefined, country: sp.get("country") ?? undefined, limit: Number(sp.get("limit") ?? 50) });
    const dataClass = status.fetchedAt == null ? "UNAVAILABLE" : window === "previous" ? "HISTORICAL" : status.dataClass;
    return json({
      provider: LL2_META.id, attribution: LL2_META.attribution, dataClass, fetchedAt: status.fetchedAt, ageSeconds: status.ageSeconds, stale: status.stale,
      notice: status.lastError ? `Last refresh failed: ${status.lastError}` : undefined, source: status.source, data: launches,
    });
  } catch (e) {
    return json({ provider: LL2_META.id, dataClass: "UNAVAILABLE", stale: true, notice: (e as Error).message, data: [] }, { status: 503 });
  }
}
