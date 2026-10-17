import type { ProviderMetadata, ProviderStatus } from "./types";

type Entry = { meta: ProviderMetadata; status: ProviderStatus; isConfigured: () => boolean; backoffUntil?: number };
const g = globalThis as unknown as { __aetherraProviders?: Map<string, Entry> };
const reg: Map<string, Entry> = (g.__aetherraProviders ??= new Map());

export function registerProvider(meta: ProviderMetadata, isConfigured: () => boolean = () => true) {
  if (!reg.has(meta.id)) {
    reg.set(meta.id, { meta, isConfigured, status: { id: meta.id, configured: isConfigured(), state: "idle", consecutiveFailures: 0 } });
  }
  return meta;
}

export function recordSuccess(id: string) {
  const e = reg.get(id);
  if (!e) return;
  e.status = { ...e.status, state: "ok", lastSuccess: new Date().toISOString(), consecutiveFailures: 0 };
  e.backoffUntil = undefined;
}

export function recordFailure(id: string, message: string, retryAfterSeconds?: number) {
  const e = reg.get(id);
  if (!e) return;
  const failures = e.status.consecutiveFailures + 1;
  // Circuit breaker: exponential backoff after repeated failures (cap 30 min).
  const backoffSec = retryAfterSeconds ?? (failures >= 3 ? Math.min(1800, 15 * 2 ** (failures - 3)) : 0);
  e.backoffUntil = backoffSec ? Date.now() + backoffSec * 1000 : undefined;
  e.status = {
    ...e.status,
    state: failures >= 3 ? "down" : "degraded",
    lastError: message,
    lastErrorAt: new Date().toISOString(),
    consecutiveFailures: failures,
    nextAllowedAt: e.backoffUntil ? new Date(e.backoffUntil).toISOString() : undefined,
  };
}

export function getBackoffUntil(id: string) {
  return reg.get(id)?.backoffUntil;
}

export function listProviders() {
  return [...reg.values()].map((e) => ({
    meta: e.meta,
    status: { ...e.status, configured: e.isConfigured(), state: e.isConfigured() ? e.status.state : ("unconfigured" as const) },
  }));
}
