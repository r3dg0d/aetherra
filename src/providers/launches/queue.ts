import { and, eq, inArray, lt } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { deliveryEvents, inbox, subscriptions } from "@/server/db/schema";
import type { DetectedChange, NormalizedLaunch } from "./types";
import { describeChange } from "./changeDetector";
import { matches } from "./subscriptions";

type Sub = typeof subscriptions.$inferSelect;

/** Enqueue change alerts for matching subscriptions. Dedupe key = subscription + change key. */
export async function enqueueChanges(db: Db, changes: DetectedChange[], launchesById: Map<string, NormalizedLaunch>) {
  const notifiable = changes.filter((c) => c.notify);
  if (!notifiable.length) return 0;
  const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.active, true), eq(subscriptions.notifyChanges, true)));
  const rows = [];
  for (const c of notifiable) {
    const l = launchesById.get(c.launchId);
    if (!l) continue;
    const { title, body } = describeChange(c, l.name, "UTC");
    for (const s of subs) if (matches(s, l)) rows.push({ subscriptionId: s.id, launchId: l.id, kind: c.kind, title, body, dedupeKey: `${s.id}|${c.dedupeKey}` });
  }
  if (!rows.length) return 0;
  const inserted = await db.insert(deliveryEvents).values(rows).onConflictDoNothing().returning({ id: deliveryEvents.id });
  return inserted.length;
}

/** Reminder scheduling: T-minus alerts are only created for launches with minute-or-better precision. */
export async function enqueueReminders(db: Db, upcoming: NormalizedLaunch[], now = Date.now()) {
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.active, true));
  const rows = [];
  for (const l of upcoming) {
    if (!["Second", "Minute"].includes(l.netPrecision ?? "")) continue;
    if (!["Go", "TBC"].includes(l.statusAbbrev)) continue;
    const net = Date.parse(l.net);
    for (const s of subs) {
      if (!matches(s, l)) continue;
      for (const lead of s.leadMinutes) {
        const fireAt = net - lead * 60_000;
        // Fire within a 15-minute grace window; never send stale reminders after a long outage.
        if (now >= fireAt && now < net && now - fireAt < 15 * 60_000) {
          rows.push({ subscriptionId: s.id, launchId: l.id, kind: "REMINDER", title: `T−${lead} min: ${l.name}`, body: `${l.rocketName ?? "Launch"} from ${l.padName ?? "pad"} · NET ${new Date(l.net).toISOString().replace(".000", "")}`, dedupeKey: `${s.id}|${l.id}:REMIND:${lead}:${l.net}` });
        }
      }
    }
  }
  if (!rows.length) return 0;
  return (await db.insert(deliveryEvents).values(rows).onConflictDoNothing().returning({ id: deliveryEvents.id })).length;
}

export type PushSender = (sub: Sub, payload: { title: string; body: string; url: string; tag: string }) => Promise<{ ok: boolean; gone?: boolean; error?: string }>;

/** Delivery queue worker. Every event lands in the in-app inbox; web-push subscribers also get a push. */
export async function processQueue(db: Db, sendPush: PushSender | null, opts: { batch?: number } = {}) {
  const pending = await db.select().from(deliveryEvents).where(and(inArray(deliveryEvents.status, ["queued", "failed"]), lt(deliveryEvents.attempts, 3))).limit(opts.batch ?? 100);
  let sent = 0;
  for (const ev of pending) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, ev.subscriptionId));
    if (!sub || !sub.active) {
      await db.update(deliveryEvents).set({ status: "skipped" }).where(eq(deliveryEvents.id, ev.id));
      continue;
    }
    await db.insert(inbox).values({ clientId: sub.clientId, launchId: ev.launchId, kind: ev.kind, title: ev.title, body: ev.body, dedupeKey: `${sub.clientId}|${ev.dedupeKey.split("|").slice(1).join("|")}` }).onConflictDoNothing();
    let status = "sent", err: string | null = null;
    if (sub.channel === "webpush") {
      if (!sendPush) { status = "skipped"; err = "web push not configured (VAPID keys missing)"; }
      else {
        const r = await sendPush(sub, { title: ev.title, body: ev.body, url: `/launches/${ev.launchId}`, tag: ev.dedupeKey });
        if (!r.ok) {
          status = "failed"; err = r.error ?? "push failed";
          if (r.gone) { await db.update(subscriptions).set({ active: false }).where(eq(subscriptions.id, sub.id)); status = "skipped"; }
        }
      }
    }
    await db.update(deliveryEvents).set({ status, attempts: ev.attempts + 1, lastError: err, sentAt: status === "sent" ? new Date() : null }).where(eq(deliveryEvents.id, ev.id));
    if (status === "sent") sent++;
  }
  return { processed: pending.length, sent };
}
