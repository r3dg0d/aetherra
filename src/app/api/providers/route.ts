import { json } from "@/server/http";
import { listProviders } from "@/providers/core/registry";
import "@/providers/celestrak/adapter";
import "@/providers/opensky/adapter";
import "@/providers/faa/swim.adapter";
import "@/providers/overpass/adapter";
import "@/providers/launches/ll2.adapter";
import "@/providers/launches/nasa.adapter";
import "@/providers/launches/spacex.adapter";
import "@/providers/nominatim/adapter";
import "@/providers/planetary-imagery/mars-raw.adapter";
import "@/providers/planetary-imagery/nasa-ivl.adapter";
import { feedStatus } from "@/providers/launches/service";
import { vapidConfigured } from "@/providers/launches/push";
import { swimStatus } from "@/providers/faa/swim.adapter";

/** Provider metadata + health. Never returns secret values, only whether env vars are set. */
export async function GET() {
  let launches: { upcoming: Awaited<ReturnType<typeof feedStatus>>; previous: Awaited<ReturnType<typeof feedStatus>> } | { error: string } | null = null;
  try { launches = { upcoming: await feedStatus("upcoming"), previous: await feedStatus("previous") }; } catch (e) { launches = { error: (e as Error).message }; }
  const providers = listProviders().map((p) => {
    let status = p.status;
    // LL2 is fetched on a budget and persisted. After a restart the in-memory status is "idle" until the next fetch,
    // so derive it from the persisted snapshot instead of showing a misleading idle state.
    if (p.meta.id === "ll2" && launches && "upcoming" in launches && status.state === "idle") {
      const up = launches.upcoming;
      if (up.fetchedAt) status = { ...status, state: up.stale ? "degraded" : "ok", lastSuccess: up.fetchedAt, lastError: up.lastError ?? undefined, note: `From persisted snapshot (${up.dataClass}); next fetch when the cache expires.` };
      else if (up.lastError) status = { ...status, state: "down", lastError: up.lastError };
    }
    return { ...p.meta, envVars: p.meta.envVars.map((name) => ({ name, set: !!process.env[name] })), status };
  });
  return json({
    providers, launches, webPush: { configured: vapidConfigured() }, faaSwim: swimStatus(),
    cesiumIon: { configured: !!process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN },
    database: process.env.DATABASE_URL ? "postgres" : "pglite (embedded fallback)",
  });
}
