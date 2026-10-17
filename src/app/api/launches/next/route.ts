import { json } from "@/server/http";
import { listLaunches } from "@/providers/launches/service";

/** Next verified launch: earliest upcoming with status Go/TBC and a NET precise to the hour or better. */
export async function GET() {
  try {
    const { launches, status } = await listLaunches({ window: "upcoming", limit: 60 });
    const now = Date.now();
    const verified = launches.find((l) => ["Go", "TBC"].includes(l.statusAbbrev) && ["Second", "Minute", "Hour"].includes(l.netPrecision ?? "") && Date.parse(l.net) > now - 3600_000);
    const next = verified ?? launches.find((l) => Date.parse(l.net) > now) ?? null;
    return json({ data: next, verified: !!verified, dataClass: status.fetchedAt ? status.dataClass : "UNAVAILABLE", fetchedAt: status.fetchedAt, stale: status.stale, attribution: "Launch Library 2 (The Space Devs)" });
  } catch (e) {
    return json({ data: null, dataClass: "UNAVAILABLE", notice: (e as Error).message }, { status: 503 });
  }
}
