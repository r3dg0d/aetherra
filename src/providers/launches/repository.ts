import { and, asc, desc, eq, gte, lt, inArray, or, ilike, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { launches, launchUpdates, providerSnapshots } from "@/server/db/schema";
import type { DetectedChange, NormalizedLaunch } from "./types";
import { detectChanges } from "./changeDetector";

type Row = typeof launches.$inferSelect;

export function rowToLaunch(r: Row): NormalizedLaunch & { fetchedAt: string } {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: r.id, source: "ll2", slug: r.slug, name: r.name, statusAbbrev: r.statusAbbrev, statusName: r.statusName,
    net: r.net.toISOString(), netPrecision: r.netPrecision, windowStart: iso(r.windowStart), windowEnd: iso(r.windowEnd),
    operatorName: r.operatorName, operatorAbbrev: r.operatorAbbrev, operatorType: r.operatorType, customers: r.customers,
    rocketName: r.rocketName, rocketFamily: r.rocketFamily, missionName: r.missionName, missionType: r.missionType,
    missionDescription: r.missionDescription, orbit: r.orbit, padName: r.padName, padLat: r.padLat, padLon: r.padLon,
    locationName: r.locationName, locationTz: r.locationTz, countryCode: r.countryCode, webcastLive: r.webcastLive,
    vidUrls: r.vidUrls, infoUrls: r.infoUrls, imageUrl: r.imageUrl, imageCredit: r.imageCredit, patches: r.patches,
    timeline: r.timeline, probability: r.probability, failReason: r.failReason, upstreamUpdatedAt: iso(r.upstreamUpdatedAt),
    fetchedAt: r.fetchedAt.toISOString(),
  };
}

function toRow(l: NormalizedLaunch, fetchedAt: Date) {
  const d = (s: string | null) => (s ? new Date(s) : null);
  return {
    ...l, net: new Date(l.net), windowStart: d(l.windowStart), windowEnd: d(l.windowEnd), upstreamUpdatedAt: d(l.upstreamUpdatedAt), fetchedAt,
  };
}

/**
 * Upsert a validated batch and return the changes detected against the stored copies.
 * Runs in a transaction: a failure leaves the previous schedule untouched.
 */
export async function ingestLaunches(db: Db, batch: NormalizedLaunch[], now = new Date()): Promise<DetectedChange[]> {
  if (!batch.length) return [];
  const changes: DetectedChange[] = [];
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(launches).where(inArray(launches.id, batch.map((b) => b.id)));
    const byId = new Map(existing.map((e) => [e.id, rowToLaunch(e)]));
    for (const l of batch) {
      const prev = byId.get(l.id);
      // Ignore older upstream snapshots (out-of-order responses must not roll back a schedule).
      if (prev?.upstreamUpdatedAt && l.upstreamUpdatedAt && Date.parse(l.upstreamUpdatedAt) < Date.parse(prev.upstreamUpdatedAt)) continue;
      const c = detectChanges(prev, l, now.getTime());
      changes.push(...c);
      const row = toRow(l, now);
      await tx.insert(launches).values({ ...row, firstSeenAt: now }).onConflictDoUpdate({ target: launches.id, set: row });
    }
    const recordable = changes.filter((c) => c.kind !== "NEW");
    if (recordable.length) {
      await tx.insert(launchUpdates).values(recordable.map((c) => ({ launchId: c.launchId, kind: c.kind, fromValue: c.from, toValue: c.to, dedupeKey: c.dedupeKey, detectedAt: now }))).onConflictDoNothing();
    }
  });
  return changes;
}

export interface LaunchQuery { window?: "upcoming" | "previous" | "all"; operator?: string; q?: string; country?: string; limit?: number; now?: Date }

export async function queryLaunches(db: Db, q: LaunchQuery = {}) {
  const now = q.now ?? new Date();
  const conds = [];
  // A launch stays "upcoming" for 2h after NET unless it has a final status.
  const finalStatuses = ["Success", "Failure", "Partial Failure"];
  if (q.window === "upcoming") conds.push(and(gte(launches.net, new Date(now.getTime() - 2 * 3600_000)), sql`${launches.statusName} not in ('Launch Successful','Launch Failure','Launch was a Partial Failure')`, sql`${launches.statusAbbrev} not in (${sql.join(finalStatuses.map((s) => sql`${s}`), sql`, `)})`));
  if (q.window === "previous") conds.push(lt(launches.net, now));
  if (q.operator) conds.push(or(ilike(launches.operatorName, `%${q.operator}%`), ilike(launches.operatorAbbrev, `%${q.operator}%`), sql`${launches.customers}::text ilike ${"%" + q.operator + "%"}`));
  if (q.country) conds.push(eq(launches.countryCode, q.country.toUpperCase()));
  if (q.q) conds.push(or(ilike(launches.name, `%${q.q}%`), ilike(launches.padName, `%${q.q}%`), ilike(launches.locationName, `%${q.q}%`), ilike(launches.rocketName, `%${q.q}%`)));
  const rows = await db.select().from(launches).where(conds.length ? and(...conds) : undefined)
    .orderBy(q.window === "previous" ? desc(launches.net) : asc(launches.net)).limit(Math.min(q.limit ?? 50, 200));
  return rows.map(rowToLaunch);
}

export async function getLaunchById(db: Db, id: string) {
  const [r] = await db.select().from(launches).where(eq(launches.id, id));
  return r ? rowToLaunch(r) : null;
}

export async function getLaunchUpdates(db: Db, id: string) {
  return db.select().from(launchUpdates).where(eq(launchUpdates.launchId, id)).orderBy(desc(launchUpdates.detectedAt)).limit(50);
}

export async function getSnapshot(db: Db, key: string) {
  const [s] = await db.select().from(providerSnapshots).where(eq(providerSnapshots.key, key));
  return s ?? null;
}

/** Quota accounting per rolling clock hour. Returns false if the request must not be made. */
export async function takeQuota(db: Db, key: string, budget: number, now = new Date()) {
  const s = await getSnapshot(db, key);
  const windowStart = s?.windowStartedAt && now.getTime() - s.windowStartedAt.getTime() < 3600_000 ? s.windowStartedAt : now;
  const count = windowStart === now ? 0 : (s?.requestCount ?? 0);
  if (count >= budget) return false;
  await db.insert(providerSnapshots).values({ key, requestCount: count + 1, windowStartedAt: windowStart, lastAttemptAt: now })
    .onConflictDoUpdate({ target: providerSnapshots.key, set: { requestCount: count + 1, windowStartedAt: windowStart, lastAttemptAt: now } });
  return true;
}

export async function markSnapshot(db: Db, key: string, ok: boolean, error?: string, now = new Date()) {
  const set = ok ? { fetchedAt: now, lastError: null, lastAttemptAt: now } : { lastError: error ?? "unknown", lastAttemptAt: now };
  await db.insert(providerSnapshots).values({ key, ...set }).onConflictDoUpdate({ target: providerSnapshots.key, set });
}
