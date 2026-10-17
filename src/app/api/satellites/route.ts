import { json, bad } from "@/server/http";
import { CELESTRAK_META, SAT_GROUPS, getGroup, type SatGroup } from "@/providers/celestrak/adapter";
import { envelope } from "@/providers/core/envelope";

export async function GET(req: Request) {
  const group = (new URL(req.url).searchParams.get("group") ?? "stations") as SatGroup;
  if (!(group in SAT_GROUPS)) return bad(`unknown group; one of ${Object.keys(SAT_GROUPS).join(", ")}`);
  try {
    const r = await getGroup(group);
    // GP data are model inputs; positions derived from them are PREDICTED. Staleness is about the element set download.
    return json(envelope(CELESTRAK_META, r.value, r.fetchedAt, { stale: r.stale, notice: r.stale ? `CelesTrak refresh failed (${r.error}); serving cached elements` : undefined }), { maxAge: 600 });
  } catch (e) {
    return json(envelope(CELESTRAK_META, [], null, { dataClass: "UNAVAILABLE", notice: `CelesTrak unavailable: ${(e as Error).message}` }), { status: 502 });
  }
}
