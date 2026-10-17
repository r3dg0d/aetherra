import { json, bad } from "@/server/http";
import { OPENSKY_META, getStates, authMode } from "@/providers/opensky/adapter";
import { simulatedTraffic } from "@/lib/flights/interpolate";
import { swimStatus } from "@/providers/faa/swim.adapter";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const n = (k: string, d: number) => { const v = Number(sp.get(k)); return Number.isFinite(v) && sp.get(k) !== null ? v : d; };
  const bbox = { lamin: n("lamin", 45), lomin: n("lomin", 5), lamax: n("lamax", 50), lomax: n("lomax", 12) };
  if (bbox.lamax <= bbox.lamin || bbox.lomax <= bbox.lomin) return bad("invalid bbox");
  if ((bbox.lamax - bbox.lamin) * (bbox.lomax - bbox.lomin) > 400) return bad("bbox too large (max 400 sq deg) to protect the shared OpenSky quota");
  if (sp.get("mode") === "demo") {
    const now = Math.floor(Date.now() / 1000);
    return json({ provider: "aetherra-demo", attribution: "AETHERRA synthetic demo traffic", dataClass: "SIMULATED", stale: false, fetchedAt: new Date().toISOString(), notice: "SIMULATED aircraft for demonstration. Not real flights.", data: { time: now, states: simulatedTraffic(7, { lat: (bbox.lamin + bbox.lamax) / 2, lon: (bbox.lomin + bbox.lomax) / 2 }, 40, now) }, swim: swimStatus() });
  }
  try {
    const r = await getStates(bbox);
    const ageS = Math.round(Date.now() / 1000 - r.value.time);
    return json({
      provider: OPENSKY_META.id, attribution: OPENSKY_META.attribution, auth: authMode(),
      // OpenSky positions are near-real-time but not instantaneous (anonymous: 10 s resolution, plus caching).
      dataClass: r.stale ? "DELAYED" : ageS <= 30 ? "LIVE" : "DELAYED", stale: r.stale, fetchedAt: new Date(r.fetchedAt).toISOString(), ageSeconds: ageS,
      notice: r.stale ? `OpenSky refresh failed (${r.error}); showing last positions` : undefined, data: r.value, swim: swimStatus(),
    });
  } catch (e) {
    return json({ provider: OPENSKY_META.id, dataClass: "UNAVAILABLE", stale: true, notice: `OpenSky unavailable: ${(e as Error).message}. Switch to demo mode to see SIMULATED traffic.`, data: { time: null, states: [] }, swim: swimStatus() }, { status: 502 });
  }
}
