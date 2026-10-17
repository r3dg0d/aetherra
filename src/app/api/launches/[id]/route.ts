import { json, bad, isUuid } from "@/server/http";
import { getLaunch } from "@/providers/launches/service";
import { getLaunchUpdates } from "@/providers/launches/repository";
import { getDb } from "@/server/db/client";
import { describeStreams } from "@/providers/launches/livestream";
import { isNasaInvolved, NASA_OFFICIAL } from "@/providers/launches/nasa.adapter";
import { isSpaceXOperated, SPACEX_OFFICIAL } from "@/providers/launches/spacex.adapter";
import { reconstructAscent } from "@/providers/launches/reconstruction";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("invalid launch id");
  const l = await getLaunch(id);
  if (!l) return json({ error: "not found", dataClass: "UNAVAILABLE" }, { status: 404 });
  const db = (await getDb()).db;
  const updates = await getLaunchUpdates(db, id);
  const official: { label: string; url: string }[] = [];
  if (isNasaInvolved(l)) official.push({ label: "NASA launch schedule", url: NASA_OFFICIAL.schedule }, { label: "NASA+", url: NASA_OFFICIAL.nasaPlus });
  if (isSpaceXOperated(l)) official.push({ label: "SpaceX launches", url: SPACEX_OFFICIAL.launches });
  const recon = l.padLat != null && l.padLon != null ? reconstructAscent({ padLat: l.padLat, padLon: l.padLon, events: l.timeline }) : null;
  const past = Date.parse(l.net) < Date.now();
  return json({
    data: l, updates, streams: describeStreams(l.vidUrls, l.statusAbbrev), official, reconstruction: recon,
    dataClass: past ? "HISTORICAL" : "LIVE", attribution: "Launch Library 2 (The Space Devs)",
  });
}
