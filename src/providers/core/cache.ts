/**
 * Small in-process TTL cache with in-flight request coalescing and stale-while-error semantics.
 * Upstream outages never erase the last good value: callers get it back flagged as stale.
 */
type Slot<T> = { value: T; fetchedAt: number };
const g = globalThis as unknown as { __aetherraCache?: Map<string, Slot<unknown>>; __aetherraInflight?: Map<string, Promise<unknown>> };
const store = (g.__aetherraCache ??= new Map());
const inflight = (g.__aetherraInflight ??= new Map());

export interface CachedResult<T> {
  value: T;
  fetchedAt: number;
  fromCache: boolean;
  stale: boolean;
  error?: string;
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>, opts: { now?: number } = {}): Promise<CachedResult<T>> {
  const now = opts.now ?? Date.now();
  const hit = store.get(key) as Slot<T> | undefined;
  if (hit && now - hit.fetchedAt < ttlMs) return { value: hit.value, fetchedAt: hit.fetchedAt, fromCache: true, stale: false };
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = loader();
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }
  try {
    const value = await p;
    const slot = { value, fetchedAt: Date.now() };
    store.set(key, slot);
    return { ...slot, fromCache: false, stale: false };
  } catch (e) {
    if (hit) return { value: hit.value, fetchedAt: hit.fetchedAt, fromCache: true, stale: true, error: e instanceof Error ? e.message : String(e) };
    throw e;
  }
}

export function peekCache<T>(key: string): Slot<T> | undefined {
  return store.get(key) as Slot<T> | undefined;
}

export function clearCache() {
  store.clear();
}
