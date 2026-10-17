# Providers

Each adapter registers `ProviderMetadata`: operator, homepage, licence, attribution, default class, expected refresh, credentials and rate limit. Live state is visible at `/status` and `GET /api/providers`.

| Provider | Adapter | Class | Cache / limits | Credentials |
|---|---|---|---|---|
| Launch Library 2 (The Space Devs) | `providers/launches/ll2.adapter.ts` | LIVE (DELAYED when aged) | Upcoming 15 min, previous 2 h. Hourly budget 12 (prod, anonymous) / 60 (lldev) / 200 (token), override with `LL2_MAX_REQUESTS_PER_HOUR` | optional `LL2_API_TOKEN` |
| NASA launch schedule | `nasa.adapter.ts` | links only | Derived from LL2 info URLs; no scraping | none |
| SpaceX official | `spacex.adapter.ts` | links only | Derived from LL2 info/vid URLs | none |
| CelesTrak GP | `providers/celestrak/adapter.ts` | PREDICTED | 2 h per group (CelesTrak asks for no more than one download per group per update) | none |
| OpenSky Network | `providers/opensky/adapter.ts` | LIVE / DELAYED | bbox ≤ 400 sq°, rounded. 15 s anonymous, 6 s with OAuth | optional `OPENSKY_CLIENT_ID/SECRET` (OAuth2 client credentials) |
| FAA SWIM (SCDS) | `providers/faa/swim.adapter.ts` | **UNAVAILABLE** | Stub: needs an approved SCDS subscription and a JMS/Solace consumer, not implemented | `FAA_SWIM_JMS_URL`, `_USERNAME`, `_PASSWORD`, `_QUEUE` |
| Overpass API (OSM) | `providers/overpass/adapter.ts` | HISTORICAL | bbox ≤ 0.05 sq°, 24 h cache, 55 s timeout | none (`OVERPASS_URL`) |
| Nominatim (OSM) | `providers/nominatim/adapter.ts` | HISTORICAL | 1 req/s server-side limiter, 7-day cache | none (`NOMINATIM_URL`) |
| NASA GIBS | `providers/gibs/layers.ts` (client tiles) | HISTORICAL (daily) | Browser loads WMTS EPSG:3857 tiles directly | none |
| OpenStreetMap tiles | Cesium imagery | HISTORICAL | Light use per OSMF tile policy | none |
| Cesium ion | Cesium | — | World Terrain + OSM Buildings only with a token | `NEXT_PUBLIC_CESIUM_ION_TOKEN` |
| Perseverance raw images (NASA/JPL) | `providers/planetary-imagery/mars-raw.adapter.ts` | DELAYED | `mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json` (`sol`, `search=<INSTRUMENT>`). 10 min cache, self-limit 30 calls / 10 min | none |
| Curiosity raw images (NASA/JPL) | `mars-raw.adapter.ts` | DELAYED | `mars.nasa.gov/api/v1/raw_image_items/?condition_1=msl:mission` (`condition_2/3=<sol>:sol:gte/lte`, `search=<INSTRUMENT>`). Thumbnails dropped. 10 min cache, 30 / 10 min | none |
| NASA Image and Video Library | `providers/planetary-imagery/nasa-ivl.adapter.ts` | HISTORICAL | `images-api.nasa.gov/search` with curated per-target mission queries (`targets.ts`). 24 h cache, 60 / 10 min | none |
| astronomy-engine | local | PREDICTED | Computed in the browser | — |
| AETHERRA demo traffic | `lib/flights/interpolate.ts` | **SIMULATED** | Seeded PRNG, `mode=demo` | — |

## Shared HTTP behaviour (`core/http.ts`)

- Timeout per request (AbortController) and a descriptive `User-Agent`.
- Bounded retries with jittered exponential backoff on 5xx and network errors (other 4xx errors are not retried). On 429/503 the provider backs off for `Retry-After` (or an exponential default).
- Circuit breaker: after repeated failures the provider enters backoff, and calls fail fast until it ends. The state shows on `/status`.
- `core/cache.ts` coalesces concurrent identical requests and serves stale data on error (`stale: true`).

## Adding a provider

1. Create `providers/<name>/adapter.ts` and call `registerProvider(meta, isConfigured)`.
2. Fetch with `fetchJson`, wrap in `cached`, and return values plus `fetchedAt`.
3. Expose it via a route handler that returns `envelope(meta, value, fetchedAt, {...})`.
4. Import it in `app/api/providers/route.ts` so it appears on `/status`.

## Planetary imagery notes

- **Checked live on 2026-10-17:**
  - The Perseverance RSS JSON feed and the Curiosity `api/v1/raw_image_items` endpoint both work.
  - The Curiosity RSS variant (`category=msl`) timed out.
  - The old `api.nasa.gov/mars-photos` (Heroku) API is dead ("No such app"), so it isn't used.
- **No fabricated items:** route parameters are allowlisted (target, rover, camera, sol 0–20000, curated query ids). If an upstream fails, the route returns `UNAVAILABLE` with an empty list, or the last cached page marked `stale`. It never returns placeholder images.
- **Image hosts:** URLs are restricted to `mars.nasa.gov` and `images-assets.nasa.gov`. Normalization drops anything else, and `/sky` sends a matching `img-src` Content-Security-Policy. Thumbnails are loaded from those NASA hosts, which NASA's media guidelines allow.
- **Labels:**
  - Raw rover images are labelled RAW · UNCALIBRATED.
  - Library items are classified as PHOTO, ILLUSTRATION (artist's concept, rendering, diagram; hidden by default) or PROCESSED (citizen-scientist or enhanced). Items with a CC BY note get a rights warning.
  - Library dates are the record's `date_created`, which can differ from the acquisition date. The UI says so.
- **Not integrated:**
  - LROC: the QuickMap WMS at `wms.im-ldi.com` responds, but it serves map tiles, not an image catalogue.
  - JunoCam: only the HTML processing site exists; JunoCam products come through the NASA library instead.
  - Chang'e: no official open JSON API was found, so it's omitted.
