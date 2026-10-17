import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizeLl2, splitOperatorAndCustomers, Ll2LaunchSchema } from "@/providers/launches/normalize";
import { detectChanges, describeChange } from "@/providers/launches/changeDetector";
import { ingestLaunches, queryLaunches, takeQuota } from "@/providers/launches/repository";
import { subscribe, unsubscribe, listSubscriptions } from "@/providers/launches/subscriptions";
import { enqueueChanges, enqueueReminders, processQueue } from "@/providers/launches/queue";
import { buildIcs } from "@/providers/launches/ics";
import { formatCountdown } from "@/providers/launches/countdown";
import { parseIsoDuration } from "@/providers/launches/timeline";
import { deliveryEvents, inbox, launchUpdates } from "@/server/db/schema";
import type { NormalizedLaunch } from "@/providers/launches/types";
import type { Db } from "@/server/db/client";
import { memoryDb } from "./helpers/db";

// Real LL2 2.3.0 response captured from lldev (development endpoint) for shape fidelity.
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/ll2-upcoming-detailed.sample.json"), "utf8"));
const base = normalizeLl2(fixture.results[0])!;
const CLIENT = "6f1c2a52-3b7e-4c1a-9a51-1f6d1f3b2a10";

const at = (iso: string) => new Date(iso);
const withNet = (l: NormalizedLaunch, net: string, extra: Partial<NormalizedLaunch> = {}): NormalizedLaunch => ({ ...l, net, windowStart: net, windowEnd: net, upstreamUpdatedAt: new Date(Date.parse(l.upstreamUpdatedAt ?? "2026-01-01") + 60_000).toISOString(), ...extra });

describe("LL2 normalization", () => {
  it("parses a real LL2 detailed record", () => {
    expect(base.id).toMatch(/[0-9a-f-]{36}/);
    expect(base.operatorName).toBeTruthy();
    expect(typeof base.padLat).toBe("number");
    expect(base.timeline.length).toBeGreaterThan(0);
    expect(base.net).toMatch(/Z$/);
  });
  it("rejects malformed records instead of writing partial data", () => {
    expect(normalizeLl2({ id: "x", name: "bad" })).toBeNull();
    expect(normalizeLl2({ ...fixture.results[0], net: "not-a-date" })).toBeNull();
  });
  it("separates operator from customers", () => {
    const raw = Ll2LaunchSchema.parse({ ...fixture.results[0], launch_service_provider: { name: "SpaceX", abbrev: "SpX", type: "Commercial" }, mission: { ...fixture.results[0].mission, agencies: [{ name: "National Aeronautics and Space Administration", abbrev: "NASA" }, { name: "SpaceX", abbrev: "SpX" }] } });
    const r = splitOperatorAndCustomers(raw);
    expect(r.operatorName).toBe("SpaceX");
    expect(r.customers).toEqual(["National Aeronautics and Space Administration"]);
  });
  it("parses ISO-8601 timeline durations", () => {
    expect(parseIsoDuration("PT1M56S")).toBe(116);
    expect(parseIsoDuration("-PT2H30M")).toBe(-9000);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
    expect(parseIsoDuration("P0D")).toBe(0);
  });
});

describe("schedule change detection", () => {
  const prev = { ...base, net: "2026-11-01T12:00:00.000Z", statusAbbrev: "Go", statusName: "Go for Launch" };
  it("ignores sub-minute jitter", () => {
    expect(detectChanges(prev, { ...prev, net: "2026-11-01T12:00:30.000Z" }, Date.parse("2026-10-20T00:00:00Z")).filter((c) => c.kind.startsWith("NET"))).toHaveLength(0);
  });
  it("NET slip days ahead is a NET_CHANGED", () => {
    const c = detectChanges(prev, { ...prev, net: "2026-11-03T12:00:00.000Z" }, Date.parse("2026-10-20T00:00:00Z"));
    expect(c.map((x) => x.kind)).toContain("NET_CHANGED");
  });
  it("NET slip near T-0 is classified as SCRUBBED", () => {
    const c = detectChanges(prev, { ...prev, net: "2026-11-02T11:40:00.000Z" }, Date.parse("2026-11-01T11:55:00Z"));
    expect(c[0].kind).toBe("SCRUBBED");
    expect(c[0].notify).toBe(true);
  });
  it("final status is LAUNCHED", () => {
    const c = detectChanges(prev, { ...prev, statusAbbrev: "Success", statusName: "Launch Successful" });
    expect(c[0].kind).toBe("LAUNCHED");
  });
  it("dedupe keys are deterministic", () => {
    const n = { ...prev, net: "2026-11-03T12:00:00.000Z" };
    expect(detectChanges(prev, n)[0].dedupeKey).toBe(detectChanges(prev, n)[0].dedupeKey);
  });
  it("renders change text in the requested time zone", () => {
    const c = detectChanges(prev, { ...prev, net: "2026-11-03T15:30:00.000Z" }, 0)[0];
    expect(describeChange(c, "Test", "America/Los_Angeles").body).toContain("7:30 AM PST");
    expect(describeChange(c, "Test", "Asia/Tokyo").body).toContain("12:30 AM GMT+9");
  });
});

describe("persistence, rescheduling and notification dedupe (PGlite)", () => {
  let db: Db;
  beforeEach(async () => { db = await memoryDb(); });

  it("records a reschedule once and notifies each subscriber once", async () => {
    const l0 = withNet(base, "2026-11-01T12:00:00.000Z", { statusAbbrev: "Go", statusName: "Go for Launch", upstreamUpdatedAt: "2026-10-01T00:00:00.000Z" });
    await ingestLaunches(db, [l0], at("2026-10-20T00:00:00Z"));
    const sub = await subscribe(db, { clientId: CLIENT, channel: "inapp", scope: "launch", target: l0.id, leadMinutes: [60, 10], notifyChanges: true });
    const l1 = withNet(l0, "2026-11-02T12:00:00.000Z");
    const changes = await ingestLaunches(db, [l1], at("2026-10-21T00:00:00Z"));
    expect(changes.map((c) => c.kind)).toContain("NET_CHANGED");
    expect(await enqueueChanges(db, changes, new Map([[l1.id, l1]]))).toBe(1);
    // Same upstream snapshot processed again (e.g. second instance / retry): nothing new.
    const again = await ingestLaunches(db, [l1], at("2026-10-21T00:05:00Z"));
    expect(again).toHaveLength(0);
    expect(await enqueueChanges(db, changes, new Map([[l1.id, l1]]))).toBe(0);
    const r = await processQueue(db, null);
    expect(r.sent).toBe(1);
    expect(await processQueue(db, null)).toEqual({ processed: 0, sent: 0 });
    const rows = await db.select().from(inbox);
    expect(rows).toHaveLength(1);
    expect(rows[0].clientId).toBe(CLIENT);
    expect((await db.select().from(launchUpdates)).length).toBe(1);
    expect(sub.id).toBeTruthy();
  });

  it("ignores out-of-order (older) upstream snapshots", async () => {
    const l0 = withNet(base, "2026-11-01T12:00:00.000Z", { upstreamUpdatedAt: "2026-10-10T00:00:00.000Z" });
    await ingestLaunches(db, [l0]);
    const older = { ...l0, net: "2026-12-01T12:00:00.000Z", upstreamUpdatedAt: "2026-10-01T00:00:00.000Z" };
    expect(await ingestLaunches(db, [older])).toHaveLength(0);
    const [stored] = await queryLaunches(db, { window: "all" });
    expect(stored.net).toBe("2026-11-01T12:00:00.000Z");
  });

  it("scrub handling: alert says scrub, and reminders re-arm for the new NET", async () => {
    const net0 = "2026-11-01T12:00:00.000Z";
    const l0 = withNet(base, net0, { statusAbbrev: "Go", netPrecision: "Second", upstreamUpdatedAt: "2026-10-01T00:00:00.000Z" });
    await ingestLaunches(db, [l0], at("2026-11-01T10:00:00Z"));
    await subscribe(db, { clientId: CLIENT, channel: "inapp", scope: "all", leadMinutes: [60, 10], notifyChanges: true });
    // T-60 reminder fires once even if the scheduler ticks repeatedly.
    expect(await enqueueReminders(db, [l0], Date.parse("2026-11-01T11:00:30Z"))).toBe(1);
    expect(await enqueueReminders(db, [l0], Date.parse("2026-11-01T11:01:30Z"))).toBe(0);
    // Stale reminders are not sent after an outage (>15 min late).
    expect(await enqueueReminders(db, [l0], Date.parse("2026-11-01T11:59:00Z"))).toBe(1); // T-10 (fires at 11:50, within grace)
    const l1 = withNet(l0, "2026-11-02T11:30:00.000Z");
    const ch = await ingestLaunches(db, [l1], at("2026-11-01T11:55:00Z"));
    expect(ch[0].kind).toBe("SCRUBBED");
    expect(await enqueueChanges(db, ch, new Map([[l1.id, l1]]))).toBe(1);
    expect(await enqueueReminders(db, [l1], Date.parse("2026-11-02T10:31:00Z"))).toBe(1); // new T-60
    await processQueue(db, null);
    const kinds = (await db.select().from(inbox)).map((r) => r.kind).sort();
    expect(kinds).toEqual(["REMINDER", "REMINDER", "REMINDER", "SCRUBBED"]);
  });

  it("reminders skipped for coarse NET precision", async () => {
    const l0 = withNet(base, "2026-11-01T12:00:00.000Z", { statusAbbrev: "Go", netPrecision: "Month" });
    await ingestLaunches(db, [l0]);
    await subscribe(db, { clientId: CLIENT, channel: "inapp", scope: "all", leadMinutes: [60], notifyChanges: true });
    expect(await enqueueReminders(db, [l0], Date.parse("2026-11-01T11:00:30Z"))).toBe(0);
  });

  it("browser push subscription lifecycle: subscribe, upsert, deliver, gone → deactivated", async () => {
    const push = { endpoint: "https://push.example.test/abc", keys: { p256dh: "BNc...", auth: "xyz" } };
    const a = await subscribe(db, { clientId: CLIENT, channel: "webpush", scope: "all", leadMinutes: [10], notifyChanges: true, push });
    const b = await subscribe(db, { clientId: CLIENT, channel: "webpush", scope: "all", leadMinutes: [30], notifyChanges: true, push });
    expect(a.id).toBe(b.id);
    expect((await listSubscriptions(db, CLIENT))[0].leadMinutes).toEqual([30]);
    const l0 = withNet(base, "2026-11-01T12:00:00.000Z", { upstreamUpdatedAt: "2026-10-01T00:00:00.000Z" });
    await ingestLaunches(db, [l0], at("2026-10-01T00:00:00Z"));
    const ch = await ingestLaunches(db, [withNet(l0, "2026-11-05T12:00:00.000Z")], at("2026-10-02T00:00:00Z"));
    await enqueueChanges(db, ch, new Map([[l0.id, l0]]));
    const sent: string[] = [];
    await processQueue(db, async (_s, p) => { sent.push(p.title); return { ok: false, gone: true, error: "410" }; });
    expect(sent).toHaveLength(1);
    expect(await listSubscriptions(db, CLIENT)).toHaveLength(0); // expired endpoint deactivated
    const [ev] = await db.select().from(deliveryEvents);
    expect(ev.status).toBe("skipped");
    expect(await unsubscribe(db, CLIENT, { id: a.id })).toBe(1);
  });

  it("quota guard blocks requests beyond the hourly budget", async () => {
    const t = at("2026-10-01T00:00:00Z");
    for (let i = 0; i < 3; i++) expect(await takeQuota(db, "q", 3, t)).toBe(true);
    expect(await takeQuota(db, "q", 3, t)).toBe(false);
    expect(await takeQuota(db, "q", 3, at("2026-10-01T01:00:01Z"))).toBe(true);
  });
});

describe("timezones, countdown and ICS", () => {
  it("ICS emits UTC times and folds long lines", () => {
    const l = withNet(base, "2026-11-01T12:00:00.000Z", { netPrecision: "Second" });
    const ics = buildIcs([l], { baseUrl: "http://localhost:3000", now: at("2026-10-01T00:00:00Z") });
    expect(ics).toContain("DTSTART:20261101T120000Z");
    expect(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
  it("ICS uses all-day events for coarse precision", () => {
    const ics = buildIcs([withNet(base, "2026-12-01T00:00:00.000Z", { netPrecision: "Month" })], { baseUrl: "x" });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261201");
  });
  it("countdown never claims more precision than the NET", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    expect(formatCountdown("2026-10-02T01:02:03Z", "Second", now)).toBe("T− 1d 01:02:03");
    expect(formatCountdown("2026-10-02T01:02:03Z", "Minute", now)).toBe("T− 1d 01:02");
    expect(formatCountdown("2026-10-02T01:02:03Z", "Hour", now)).toContain("±1 h");
    expect(formatCountdown("2026-12-01T00:00:00Z", "Month", now)).toContain("weeks");
    expect(formatCountdown("2026-09-30T23:59:00Z", "Second", now)).toBe("T+ 00:01:00");
  });
});
