import { json, bad, isUuid } from "@/server/http";
import { getDb } from "@/server/db/client";
import { SubscribeInput, subscribe, unsubscribe, listSubscriptions } from "@/providers/launches/subscriptions";

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!isUuid(clientId)) return bad("clientId required");
  const subs = await listSubscriptions((await getDb()).db, clientId);
  return json({ data: subs.map(({ p256dh: _p, auth: _a, endpoint, ...s }) => ({ ...s, hasEndpoint: !!endpoint })) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SubscribeInput.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  try {
    const row = await subscribe((await getDb()).db, parsed.data);
    return json({ data: { id: row.id, scope: row.scope, target: row.target, channel: row.channel, leadMinutes: row.leadMinutes } }, { status: 201 });
  } catch (e) { return bad((e as Error).message); }
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { clientId?: string; id?: string; endpoint?: string };
  if (!isUuid(body.clientId)) return bad("clientId required");
  const n = await unsubscribe((await getDb()).db, body.clientId, { id: isUuid(body.id) ? body.id : undefined, endpoint: body.endpoint });
  return json({ removed: n });
}
