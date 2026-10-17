import { json, bad } from "@/server/http";
import { refreshLaunches, tick } from "@/providers/launches/service";

/** Manual refresh. Allowed in development, or with ADMIN_TOKEN in production. Still quota-gated. */
export async function POST(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (process.env.NODE_ENV === "production" && (!token || req.headers.get("authorization") !== `Bearer ${token}`)) return bad("forbidden", 403);
  const up = await refreshLaunches("upcoming", { force: true });
  const prev = await refreshLaunches("previous");
  return json({ upcoming: up, previous: prev, tick: await tick() });
}
