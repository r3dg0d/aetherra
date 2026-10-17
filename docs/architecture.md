# Architecture

```
Browser (client-only 3D views)                Next.js server (route handlers, Node runtime)
──────────────────────────────                ─────────────────────────────────────────────
app/<mode>/page.tsx → *Client.tsx             app/api/*  ──► providers/* adapters ──► upstream APIs
  dynamic(import, { ssr:false })                 │            core/http  (timeout, retries, Retry-After,
components/<mode>/*                              │                        circuit breaker / backoff)
  three / r3f scenes, Cesium viewer              │            core/cache (TTL, in-flight coalescing,
  Web Worker: workers/sgp4.worker.ts             │                        stale-on-error)
lib/astro, lib/orbit, lib/ascent (pure TS)       │            core/envelope (data class + staleness)
lib/store (Zustand: time, app, view)             ▼
public/sw.js (push / notificationclick)       server/db (Drizzle: Postgres or PGlite fallback)
                                              instrumentation.ts → 60 s scheduler tick
```

## Principles

- **Provenance first.** Every API response is a `ProviderEnvelope` with `provider`, `attribution`, `dataClass`, `fetchedAt`, `ageSeconds` and `stale`, plus an optional `notice`. The UI shows the class with `DataBadge`, and the status bar shows the class of the active view. `classifyByAge` downgrades LIVE to DELAYED as data ages. Time travel turns computed values into PREDICTED or HISTORICAL (`timeClass`).
- **Secrets stay on the server.** Adapters read env vars server-side. `/api/providers` reports only whether a variable is set. Only `NEXT_PUBLIC_CESIUM_ION_TOKEN` is public, by design (Cesium ion tokens are browser tokens).
- **Fail honest.** On upstream failure we serve the last good cached value marked `stale: true`. If nothing is cached, the class is UNAVAILABLE. We never invent values. Launch ingestion never deletes rows on a failed or invalid fetch.
- **Pure, testable cores.** Coordinates, astronomy, SGP4 wrappers, dead reckoning, ascent physics, LL2 normalisation, change detection, ICS and countdown are pure modules with Vitest coverage.

## Scene conventions (three.js)

- Earth-fixed, Y-up. `latLonToVec3`: x = cos φ cos λ, y = sin φ, z = −cos φ sin λ. ECEF (x, y, z) maps to scene (x, z, −y).
- Stars live in an inertial group rotated by −GAST, so the sky turns correctly over the fixed Earth.
- The sun direction comes from the subsolar point. The Moon is placed at its true scaled distance.
- In **ASCENT** the units are km, with a **floating origin**: the vehicle stays at the scene origin and the Earth group is translated by −r and rotated by ω⊕·t. That keeps float precision near the camera. A logarithmic depth buffer covers 0.5 m to 400,000 km.

## ASCENT physics (`lib/ascent/physics.ts`)

- Earth-centred inertial frame. Point-mass gravity μ/r², with an exponential atmosphere (ρ₀ = 1.225 kg/m³, H = 8.5 km).
- Drag uses velocity relative to the co-rotating atmosphere.
- Thrust and Isp are interpolated between sea level and vacuum by ambient pressure.
- Integration is RK4 at a fixed dt = 0.02 s with an accumulator, independent of frame rate. Time warp is capped at 4× while thrusting or below 100 km.
- Orbit insertion means e < 1 and periapsis > 140 km.
- The assist autopilot holds vertical to 1 km and flies a stage-1 gravity turn. The upper stage steers vertical speed toward the target apoapsis and cuts off when periapsis > 160 km.
- Tests verify energy and angular-momentum conservation and an end-to-end assisted insertion (~175 × 221 km).

## Launch pipeline

1. `service.refreshLaunches` fetches LL2 `/launches/upcoming` (detailed, limit 40, TTL 15 min) and `/launches/previous` (TTL 2 h). It is guarded by an hourly quota stored in `provider_snapshots`.
2. The response is validated with zod (`safeParse`). An invalid payload is logged and skipped.
3. `normalize` produces `NormalizedLaunch`. `ingestLaunches` upserts it in one transaction. `changeDetector` compares with the stored row and emits NEW, NET_CHANGED, SCRUBBED, STATUS_CHANGED, LAUNCHED or WINDOW_CHANGED with deterministic dedupe keys. Out-of-order snapshots are ignored.
4. `queue.enqueueChanges` and `enqueueReminders` write `delivery_events` (unique dedupe key). Reminders are only sent for Second/Minute precision and Go/TBC status, within a 15-minute grace window.
5. `processQueue` writes the in-app inbox and sends Web Push. Subscriptions are deactivated on 404/410.
