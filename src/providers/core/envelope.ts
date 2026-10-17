import type { DataClass } from "@/lib/classification";
import type { ProviderEnvelope, ProviderMetadata } from "./types";

/** Derive classification from age: data older than 3x the expected refresh interval is DELAYED. */
export function classifyByAge(meta: ProviderMetadata, fetchedAt: number | null, now = Date.now()): { dataClass: DataClass; stale: boolean; ageSeconds: number | null } {
  if (fetchedAt == null) return { dataClass: "UNAVAILABLE", stale: true, ageSeconds: null };
  const ageSeconds = Math.max(0, Math.round((now - fetchedAt) / 1000));
  const stale = ageSeconds > meta.expectedRefreshSeconds * 3;
  let dataClass = meta.dataClass;
  if (stale && dataClass === "LIVE") dataClass = "DELAYED";
  return { dataClass, stale, ageSeconds };
}

export function envelope<T>(meta: ProviderMetadata, data: T, fetchedAt: number | null, extra: Partial<ProviderEnvelope<T>> = {}): ProviderEnvelope<T> {
  const c = classifyByAge(meta, fetchedAt);
  return {
    provider: meta.id,
    attribution: meta.attribution,
    fetchedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
    ...c,
    ...extra,
    data,
  } as ProviderEnvelope<T>;
}
