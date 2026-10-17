/** Mission timeline service: parses ISO-8601 durations used by LL2 (e.g. "PT1M56S", "-PT2H", "P0D"). */
export function parseIsoDuration(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(s.trim());
  if (!m) return null;
  const [, neg, d, h, mi, se] = m;
  const v = (+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mi ?? 0)) * 60 + +(se ?? 0);
  return neg ? -v : v;
}

export function formatRelative(seconds: number) {
  const sign = seconds < 0 ? "T−" : "T+";
  const a = Math.abs(Math.round(seconds));
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60;
  return `${sign}${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

export function timelineAt<T extends { relativeSeconds: number }>(timeline: T[], netIso: string, now: number) {
  const t0 = Date.parse(netIso);
  return [...timeline].sort((a, b) => a.relativeSeconds - b.relativeSeconds).map((e) => ({ ...e, at: new Date(t0 + e.relativeSeconds * 1000).toISOString(), passed: now >= t0 + e.relativeSeconds * 1000 }));
}
