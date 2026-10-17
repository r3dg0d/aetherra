import type { DetectedChange, NormalizedLaunch } from "./types";

type Comparable = Pick<NormalizedLaunch, "id" | "net" | "statusAbbrev" | "statusName" | "windowStart" | "windowEnd">;

const FINAL = new Set(["Success", "Failure", "Partial Failure"]);
/** NET moves smaller than this are treated as noise (upstream rounding). */
export const NET_TOLERANCE_MS = 60_000;
/** A NET slip that happens within this window before the previous NET is treated as a scrub/recycle. */
export const SCRUB_WINDOW_MS = 3 * 3600_000;

/**
 * Schedule change detector. Pure function: compares the stored record with a freshly fetched one.
 * Dedupe keys are deterministic so re-processing the same upstream snapshot never creates duplicates.
 */
export function detectChanges(prev: Comparable | null | undefined, next: Comparable, now = Date.now()): DetectedChange[] {
  const out: DetectedChange[] = [];
  const id = next.id;
  if (!prev) {
    return [{ launchId: id, kind: "NEW", from: null, to: next.net, notify: false, dedupeKey: `${id}:NEW` }];
  }
  const prevNet = Date.parse(prev.net), nextNet = Date.parse(next.net);
  if (Math.abs(nextNet - prevNet) > NET_TOLERANCE_MS) {
    const scrub = nextNet > prevNet && now >= prevNet - SCRUB_WINDOW_MS && !FINAL.has(next.statusAbbrev) && !FINAL.has(next.statusName);
    out.push({ launchId: id, kind: scrub ? "SCRUBBED" : "NET_CHANGED", from: prev.net, to: next.net, notify: true, dedupeKey: `${id}:NET:${prev.net}->${next.net}` });
  }
  if (prev.statusAbbrev !== next.statusAbbrev) {
    const final = FINAL.has(next.statusName) || FINAL.has(next.statusAbbrev);
    out.push({ launchId: id, kind: final ? "LAUNCHED" : "STATUS_CHANGED", from: prev.statusName, to: next.statusName, notify: true, dedupeKey: `${id}:STATUS:${prev.statusAbbrev}->${next.statusAbbrev}@${next.net}` });
  }
  if ((prev.windowStart ?? "") !== (next.windowStart ?? "") || (prev.windowEnd ?? "") !== (next.windowEnd ?? "")) {
    if (!out.some((c) => c.kind === "NET_CHANGED" || c.kind === "SCRUBBED")) {
      out.push({ launchId: id, kind: "WINDOW_CHANGED", from: `${prev.windowStart}/${prev.windowEnd}`, to: `${next.windowStart}/${next.windowEnd}`, notify: false, dedupeKey: `${id}:WIN:${next.windowStart}/${next.windowEnd}` });
    }
  }
  return out;
}

export function describeChange(c: DetectedChange, name: string, tz = "UTC"): { title: string; body: string } {
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "unknown");
  switch (c.kind) {
    case "SCRUBBED": return { title: `Scrub / recycle: ${name}`, body: `New NET ${fmt(c.to)} (was ${fmt(c.from)}).` };
    case "NET_CHANGED": return { title: `Schedule change: ${name}`, body: `NET moved to ${fmt(c.to)} (was ${fmt(c.from)}).` };
    case "LAUNCHED": return { title: `${c.to}: ${name}`, body: `Status changed from ${c.from} to ${c.to}.` };
    case "STATUS_CHANGED": return { title: `Status: ${name}`, body: `${c.from} → ${c.to}` };
    default: return { title: name, body: `${c.kind}` };
  }
}
