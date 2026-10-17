export const fmtUtc = (iso: string | null, withTime = true) => {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const s = d.toISOString();
  return withTime ? `${s.slice(0, 10)} ${s.slice(11, 19)} UTC` : `${s.slice(0, 10)} UTC`;
};
