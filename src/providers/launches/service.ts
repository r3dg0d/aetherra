import "server-only";
import { getDb } from "@/server/db/client";
import { LL2_META, fetchLl2List, fetchLl2Launch, ll2BaseUrl, ll2HourlyBudget } from "./ll2.adapter";
import { getLaunchById, getSnapshot, ingestLaunches, markSnapshot, queryLaunches, takeQuota, type LaunchQuery } from "./repository";
import { enqueueChanges, enqueueReminders, processQueue } from "./queue";
import { getPushSender } from "./push";
import { classifyByAge } from "../core/envelope";

const TTL = { upcoming: 15 * 60_000, previous: 2 * 3600_000 };
const QUOTA_KEY = "ll2:quota";

const g = globalThis as unknown as { __ll2Refresh?: Partial<Record<string, Promise<unknown>>> };
const inflight = (g.__ll2Refresh ??= {});

/**
 * Launch-status updater. Refreshes the stored schedule from LL2 when it is older than its TTL and quota allows.
 * Never deletes or overwrites stored launches on failure.
 */
export async function refreshLaunches(kind: "upcoming" | "previous", opts: { force?: boolean } = {}) {
  const run = async () => {
    const db = (await getDb()).db;
    const key = `ll2:${kind}`;
    const snap = await getSnapshot(db, key);
    const age = snap?.fetchedAt ? Date.now() - snap.fetchedAt.getTime() : Infinity;
    if (!opts.force && age < TTL[kind]) return { refreshed: false, reason: "fresh" };
    if (snap?.lastAttemptAt && Date.now() - snap.lastAttemptAt.getTime() < 60_000 && !opts.force) return { refreshed: false, reason: "recent-attempt" };
    if (!(await takeQuota(db, QUOTA_KEY, ll2HourlyBudget()))) {
      await markSnapshot(db, key, false, "local LL2 hourly budget exhausted; serving cached data");
      return { refreshed: false, reason: "quota" };
    }
    try {
      const { launches, rejected } = await fetchLl2List(kind, kind === "upcoming" ? 40 : 30);
      const changes = await ingestLaunches(db, launches);
      const byId = new Map(launches.map((l) => [l.id, l]));
      const queued = await enqueueChanges(db, changes, byId);
      await markSnapshot(db, key, true);
      return { refreshed: true, count: launches.length, rejected, changes: changes.filter((c) => c.kind !== "NEW").length, queued };
    } catch (e) {
      await markSnapshot(db, key, false, (e as Error).message);
      return { refreshed: false, reason: "error", error: (e as Error).message };
    }
  };
  inflight[kind] ??= run().finally(() => { inflight[kind] = undefined; });
  return inflight[kind] as Promise<{ refreshed: boolean; reason?: string; error?: string }>;
}

export async function feedStatus(kind: "upcoming" | "previous") {
  const db = (await getDb()).db;
  const snap = await getSnapshot(db, `ll2:${kind}`);
  const fetchedAt = snap?.fetchedAt?.getTime() ?? null;
  const c = classifyByAge({ ...LL2_META, expectedRefreshSeconds: TTL[kind] / 1000 }, fetchedAt);
  return { ...c, fetchedAt: snap?.fetchedAt?.toISOString() ?? null, lastError: snap?.lastError ?? null, source: ll2BaseUrl() };
}

export async function listLaunches(q: LaunchQuery & { window: "upcoming" | "previous" }) {
  const status = await feedStatus(q.window);
  if (status.stale || status.fetchedAt == null) {
    // Refresh synchronously when we have nothing; otherwise refresh in the background (stale-while-revalidate).
    const p = refreshLaunches(q.window);
    if (status.fetchedAt == null) await p;
  }
  const db = (await getDb()).db;
  const launches = await queryLaunches(db, q);
  return { launches, status: await feedStatus(q.window) };
}

export async function getLaunch(id: string) {
  const db = (await getDb()).db;
  let l = await getLaunchById(db, id);
  if (!l && (await takeQuota(db, QUOTA_KEY, ll2HourlyBudget()))) {
    try {
      const fetched = await fetchLl2Launch(id);
      if (fetched) { await ingestLaunches(db, [fetched]); l = await getLaunchById(db, id); }
    } catch { /* fall through: not found / unavailable */ }
  }
  return l;
}

/** One scheduler tick: refresh (TTL-gated), reminders, deliveries. */
export async function tick() {
  const r = await refreshLaunches("upcoming");
  const db = (await getDb()).db;
  const upcoming = await queryLaunches(db, { window: "upcoming", limit: 60 });
  const reminders = await enqueueReminders(db, upcoming);
  const delivered = await processQueue(db, await getPushSender());
  return { refresh: r, reminders, delivered };
}
