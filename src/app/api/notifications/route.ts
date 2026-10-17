import { and, desc, eq, isNull } from "drizzle-orm";
import { json, bad, isUuid } from "@/server/http";
import { getDb } from "@/server/db/client";
import { inbox } from "@/server/db/schema";

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!isUuid(clientId)) return bad("clientId required");
  const db = (await getDb()).db;
  const rows = await db.select().from(inbox).where(eq(inbox.clientId, clientId)).orderBy(desc(inbox.createdAt)).limit(50);
  return json({ data: rows.map(({ dedupeKey: _d, ...r }) => r), unread: rows.filter((r) => !r.readAt).length });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { clientId?: string };
  if (!isUuid(body.clientId)) return bad("clientId required");
  const db = (await getDb()).db;
  await db.update(inbox).set({ readAt: new Date() }).where(and(eq(inbox.clientId, body.clientId), isNull(inbox.readAt)));
  return json({ ok: true });
}
