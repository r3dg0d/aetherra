import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { subscriptions } from "@/server/db/schema";
import { z } from "zod";

export const SubscribeInput = z.object({
  clientId: z.string().uuid(),
  channel: z.enum(["webpush", "inapp"]),
  scope: z.enum(["launch", "operator", "all"]),
  target: z.string().max(200).optional(),
  leadMinutes: z.array(z.number().int().min(1).max(1440)).max(4).default([60, 10]),
  notifyChanges: z.boolean().default(true),
  push: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).optional(),
});
export type SubscribeInput = z.infer<typeof SubscribeInput>;

/** Notification subscription manager. Anonymous by design: the only identifier is a random client UUID. */
export async function subscribe(db: Db, input: SubscribeInput) {
  if (input.channel === "webpush" && !input.push) throw new Error("push subscription required for webpush channel");
  const target = input.scope === "all" ? "*" : (input.target ?? "*");
  const values = {
    clientId: input.clientId, channel: input.channel, scope: input.scope, target,
    leadMinutes: input.leadMinutes, notifyChanges: input.notifyChanges, active: true,
    endpoint: input.push?.endpoint ?? null, p256dh: input.push?.keys.p256dh ?? null, auth: input.push?.keys.auth ?? null,
  };
  const [row] = await db.insert(subscriptions).values(values)
    .onConflictDoUpdate({ target: [subscriptions.clientId, subscriptions.channel, subscriptions.scope, subscriptions.target], set: values })
    .returning();
  return row;
}

export async function unsubscribe(db: Db, clientId: string, opts: { id?: string; endpoint?: string } = {}) {
  const conds = [eq(subscriptions.clientId, clientId)];
  if (opts.id) conds.push(eq(subscriptions.id, opts.id));
  if (opts.endpoint) conds.push(eq(subscriptions.endpoint, opts.endpoint));
  const rows = await db.update(subscriptions).set({ active: false }).where(and(...conds)).returning();
  return rows.length;
}

export async function listSubscriptions(db: Db, clientId: string) {
  return db.select().from(subscriptions).where(and(eq(subscriptions.clientId, clientId), eq(subscriptions.active, true)));
}

export function matches(sub: { scope: string; target: string | null }, l: { id: string; operatorName: string | null; operatorAbbrev?: string | null; customers: string[] }) {
  if (sub.scope === "all") return true;
  if (sub.scope === "launch") return sub.target === l.id;
  if (sub.scope === "operator") {
    const t = (sub.target ?? "").toLowerCase();
    return t.length > 1 && [l.operatorName, l.operatorAbbrev, ...l.customers].some((n) => !!n && (n.toLowerCase() === t || n.toLowerCase().includes(t)));
  }
  return false;
}
