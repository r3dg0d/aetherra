import { listLaunches } from "@/providers/launches/service";
import { buildIcs } from "@/providers/launches/ics";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const { launches } = await listLaunches({ window: "upcoming", operator: u.searchParams.get("operator") ?? undefined, limit: 100 });
  const id = u.searchParams.get("id");
  const list = id ? launches.filter((l) => l.id === id) : launches;
  return new Response(buildIcs(list, { baseUrl: `${u.protocol}//${u.host}`, name: "AETHERRA · Upcoming launches" }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="aetherra-launches.ics"`, "Cache-Control": "public, max-age=900" },
  });
}
