import { ProviderError } from "../core/types";

/** Self-imposed upstream request budget (sliding window, in-process). Upstreams publish no quota, so we stay polite. */
const g = globalThis as unknown as { __aetherraBudget?: Map<string, number[]> };
const windows = (g.__aetherraBudget ??= new Map());

export function takeBudget(provider: string, max: number, windowMs: number, now = Date.now()) {
  const w = (windows.get(provider) ?? []).filter((t: number) => now - t < windowMs);
  if (w.length >= max) {
    windows.set(provider, w);
    throw new ProviderError(`local request budget exhausted (${max} per ${Math.round(windowMs / 60000)} min)`, provider, 429, Math.ceil((windowMs - (now - w[0])) / 1000));
  }
  w.push(now);
  windows.set(provider, w);
}

export function resetBudgets() { windows.clear(); }
