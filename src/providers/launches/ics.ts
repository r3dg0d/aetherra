import type { NormalizedLaunch } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** RFC 5545 line folding at 75 octets. */
const fold = (line: string) => {
  const out: string[] = [];
  let s = line;
  while (Buffer.byteLength(s) > 75) {
    let i = 75;
    while (Buffer.byteLength(s.slice(0, i)) > 75) i--;
    out.push(s.slice(0, i));
    s = " " + s.slice(i);
  }
  out.push(s);
  return out.join("\r\n");
};

/** ICS feed: times are emitted in UTC ("Z") so every calendar renders them in the viewer's zone. */
export function buildIcs(launches: NormalizedLaunch[], opts: { baseUrl: string; now?: Date; name?: string }) {
  const now = opts.now ?? new Date();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AETHERRA//Mission Control//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(opts.name ?? "AETHERRA launches")}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const l of launches) {
    const start = new Date(l.windowStart ?? l.net);
    let end = new Date(l.windowEnd ?? l.net);
    if (end <= start) end = new Date(start.getTime() + 30 * 60000);
    const coarse = l.netPrecision && !["Second", "Minute", "Hour"].includes(l.netPrecision);
    lines.push("BEGIN:VEVENT", `UID:${l.id}@aetherra`, `DTSTAMP:${stamp(now)}`);
    if (coarse) {
      const d = start.toISOString().slice(0, 10).replace(/-/g, "");
      const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1)).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`);
    } else {
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    }
    lines.push(
      `SUMMARY:${esc(`🚀 ${l.name}`)}`,
      `DESCRIPTION:${esc(`${l.operatorName ?? ""} · ${l.rocketName ?? ""}\nStatus: ${l.statusName}\nNET precision: ${l.netPrecision ?? "unknown"}\nSource: Launch Library 2 (The Space Devs)`)}`,
      `LOCATION:${esc([l.padName, l.locationName].filter(Boolean).join(", "))}`,
      ...(l.padLat != null && l.padLon != null ? [`GEO:${l.padLat};${l.padLon}`] : []),
      `URL:${opts.baseUrl}/launches/${l.id}`,
      `STATUS:${l.statusAbbrev === "TBD" ? "TENTATIVE" : "CONFIRMED"}`,
      `LAST-MODIFIED:${stamp(new Date(l.upstreamUpdatedAt ?? now))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
