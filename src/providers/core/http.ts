import { ProviderError } from "./types";
import { recordFailure, recordSuccess, getBackoffUntil } from "./registry";

export interface FetchJsonOptions {
  provider: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
  method?: string;
  body?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Server-side JSON fetch with timeout, bounded retries with jittered exponential backoff,
 * Retry-After handling and per-provider circuit breaking via the registry.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const until = getBackoffUntil(opts.provider);
  if (until && until > Date.now()) {
    throw new ProviderError(`backing off until ${new Date(until).toISOString()}`, opts.provider, 429, Math.ceil((until - Date.now()) / 1000));
  }
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: { "User-Agent": "AETHERRA/0.1 (+https://github.com/; educational visualization)", Accept: "application/json", ...opts.headers },
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (res.status === 429 || res.status === 503) {
        const ra = Number(res.headers.get("retry-after")) || Math.min(3600, 30 * 2 ** attempt);
        const err = new ProviderError(`HTTP ${res.status}`, opts.provider, res.status, ra);
        recordFailure(opts.provider, err.message, ra);
        throw err; // do not hammer a throttled provider
      }
      if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, opts.provider, res.status);
      const json = (await res.json()) as T;
      recordSuccess(opts.provider);
      return json;
    } catch (e) {
      lastErr = e;
      if (e instanceof ProviderError && (e.status === 429 || e.status === 503 || (e.status && e.status >= 400 && e.status < 500))) break;
      if (attempt < retries) await sleep(500 * 2 ** attempt + Math.random() * 250);
    } finally {
      clearTimeout(t);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (!(lastErr instanceof ProviderError && lastErr.status === 429)) recordFailure(opts.provider, msg);
  throw lastErr instanceof ProviderError ? lastErr : new ProviderError(msg, opts.provider);
}
