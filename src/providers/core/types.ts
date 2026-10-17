import type { DataClass } from "@/lib/classification";

/** Static description every provider adapter must declare. */
export interface ProviderMetadata {
  id: string;
  name: string;
  /** Organisation operating the upstream service. */
  operator: string;
  homepage: string;
  /** Licence / terms of use summary with link. */
  license: string;
  termsUrl?: string;
  attribution: string;
  /** Default classification of fresh data from this provider. */
  dataClass: DataClass;
  /** How often upstream data is expected to change, in seconds. Used for staleness. */
  expectedRefreshSeconds: number;
  /** Whether the adapter needs credentials to work at all. */
  requiresCredentials: boolean;
  /** Env var names the adapter reads (server side only). Values are never exposed. */
  envVars: string[];
  rateLimit?: string;
}

export interface ProviderStatus {
  id: string;
  configured: boolean;
  state: "ok" | "degraded" | "down" | "unconfigured" | "idle";
  lastSuccess?: string;
  lastError?: string;
  lastErrorAt?: string;
  consecutiveFailures: number;
  nextAllowedAt?: string;
  note?: string;
}

/** Envelope returned by every provider-backed API route. */
export interface ProviderEnvelope<T> {
  provider: string;
  attribution: string;
  dataClass: DataClass;
  /** When upstream data was retrieved by AETHERRA (ISO). */
  fetchedAt: string | null;
  /** Age of the data in seconds at response time. */
  ageSeconds: number | null;
  stale: boolean;
  /** Human-readable reason when stale/unavailable/simulated. */
  notice?: string;
  data: T;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
