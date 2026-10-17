/** Countdown with honest precision labelling based on LL2 net_precision. */
export type Precision = "Second" | "Minute" | "Hour" | "Morning" | "Afternoon" | "Day" | "Week" | "Month" | "Quarter" | "Year" | string | null;

export function countdownParts(netIso: string, now: number) {
  const diff = Date.parse(netIso) - now;
  const a = Math.abs(diff);
  return { sign: diff >= 0 ? "T−" : "T+", days: Math.floor(a / 86400000), hours: Math.floor((a % 86400000) / 3600000), minutes: Math.floor((a % 3600000) / 60000), seconds: Math.floor((a % 60000) / 1000), past: diff < 0 };
}

/** Returns a countdown string whose resolution never exceeds the precision of the published NET. */
export function formatCountdown(netIso: string, precision: Precision, now: number) {
  const p = countdownParts(netIso, now);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!precision || precision === "Second" || precision === "Minute") {
    const secs = precision === "Minute" ? "" : `:${pad(p.seconds)}`;
    return `${p.sign} ${p.days ? `${p.days}d ` : ""}${pad(p.hours)}:${pad(p.minutes)}${secs}`;
  }
  if (precision === "Hour" || precision === "Morning" || precision === "Afternoon") return `${p.sign} ${p.days}d ${p.hours}h (±${precision === "Hour" ? "1 h" : "half-day"})`;
  if (precision === "Day") return `${p.sign} ~${p.days + (p.hours >= 12 ? 1 : 0)} days (date only)`;
  return `${p.sign} ~${Math.round(p.days / 7)} weeks (NET ${String(precision).toLowerCase()})`;
}

export function precisionLabel(precision: Precision) {
  if (!precision) return "Precision unknown";
  if (precision === "Second") return "Exact T-0 (to the second)";
  if (precision === "Minute") return "T-0 accurate to the minute";
  if (precision === "Hour") return "T-0 accurate to the hour";
  return `NET accurate to the ${String(precision).toLowerCase()}`;
}
