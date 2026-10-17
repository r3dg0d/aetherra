import { json } from "@/server/http";
import { getDb } from "@/server/db/client";
import { queryLaunches } from "@/providers/launches/repository";
import { getGroup } from "@/providers/celestrak/adapter";
import { geocode } from "@/providers/nominatim/adapter";

/** Server half of universal search: launches, tracked satellites and places. Sky objects are searched client-side. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return json({ data: [] });
  const out: { type: string; id: string; label: string; sub?: string; href: string; lat?: number; lon?: number }[] = [];
  const tasks: Promise<void>[] = [];
  tasks.push((async () => {
    try {
      const db = (await getDb()).db;
      for (const l of await queryLaunches(db, { window: "all", q, limit: 6 })) out.push({ type: "launch", id: l.id, label: l.name, sub: `${l.operatorName ?? ""} · ${new Date(l.net).toISOString().slice(0, 10)}`, href: `/launches/${l.id}` });
    } catch {}
  })());
  tasks.push((async () => {
    try {
      const r = await getGroup("stations");
      for (const s of r.value.filter((s) => s.OBJECT_NAME.toLowerCase().includes(q.toLowerCase()) || String(s.NORAD_CAT_ID) === q).slice(0, 6))
        out.push({ type: "satellite", id: String(s.NORAD_CAT_ID), label: s.OBJECT_NAME, sub: `NORAD ${s.NORAD_CAT_ID}`, href: `/orbit?sat=${s.NORAD_CAT_ID}` });
    } catch {}
  })());
  if (sp.get("places") !== "0") tasks.push((async () => {
    try {
      const r = await geocode(q);
      for (const p of r.value.slice(0, 5)) out.push({ type: "place", id: `${p.lat},${p.lon}`, label: p.name.split(",").slice(0, 2).join(","), sub: p.name, href: `/earth?lat=${p.lat}&lon=${p.lon}&alt=15000&label=${encodeURIComponent(p.name.split(",")[0])}`, lat: p.lat, lon: p.lon });
    } catch {}
  })());
  await Promise.all(tasks);
  return json({ data: out });
}
