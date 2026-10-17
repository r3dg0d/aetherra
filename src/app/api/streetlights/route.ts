import { json, bad } from "@/server/http";
import { getStreetlights, OVERPASS_META } from "@/providers/overpass/adapter";
import { envelope } from "@/providers/core/envelope";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const b = { s: Number(sp.get("s")), w: Number(sp.get("w")), n: Number(sp.get("n")), e: Number(sp.get("e")) };
  if (Object.values(b).some((v) => !Number.isFinite(v))) return bad("s,w,n,e required");
  try {
    const r = await getStreetlights(b);
    return json(envelope(OVERPASS_META, r.value, r.fetchedAt, { dataClass: "HISTORICAL", notice: "Mapped street lamp locations from OpenStreetMap (not live lighting state)." }), { maxAge: 3600 });
  } catch (e) {
    return json(envelope(OVERPASS_META, [], null, { dataClass: "UNAVAILABLE", notice: (e as Error).message }), { status: 502 });
  }
}
