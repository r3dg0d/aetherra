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
import { feedStatus } from "@/providers/launches/service";
import { vapidConfigured } from "@/providers/launches/push";
import { swimStatus } from "@/providers/faa/swim.adapter";

/** Provider metadata + health. Never returns secret values, only whether env vars are set. */
export async function GET() {
  const providers = listProviders().map((p) => ({ ...p.meta, envVars: p.meta.envVars.map((name) => ({ name, set: !!process.env[name] })), status: p.status }));
  let launches = null;
  try { launches = { upcoming: await feedStatus("upcoming"), previous: await feedStatus("previous") }; } catch (e) { launches = { error: (e as Error).message }; }
  return json({
    providers, launches, webPush: { configured: vapidConfigured() }, faaSwim: swimStatus(),
    cesiumIon: { configured: !!process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN },
    database: process.env.DATABASE_URL ? "postgres" : "pglite (embedded fallback)",
  });
}
