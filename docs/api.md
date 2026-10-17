# API contracts

All endpoints return JSON envelopes unless noted:

```ts
{ provider: string; attribution: string; dataClass: "LIVE"|"DELAYED"|"HISTORICAL"|"PREDICTED"|"SIMULATED"|"UNAVAILABLE";
  fetchedAt: string | null; ageSeconds: number | null; stale: boolean; notice?: string; data: T }
```

Errors use `{ error: string }` with 400/403/404/502. Responses never contain secrets.

| Method & path | Query / body | Returns |
|---|---|---|
| `GET /api/health` | none | `{ ok, db: "postgres"\|"pglite", time }` |
| `GET /api/providers` | none | Provider metadata, status (state, failures, backoff), env-var presence booleans, launch feed snapshots, webPush/ion/SWIM/database summary |
| `GET /api/launches` | `window=upcoming\|previous`, `operator`, `q`, `country`, `limit` | `data: NormalizedLaunch[]`, served from the DB with stale-while-revalidate |
| `GET /api/launches/next` | none | `data: NormalizedLaunch \| null` (next upcoming) |
| `GET /api/launches/:id` | `id` = LL2 UUID | `data: NormalizedLaunch`, plus `updates` (change history), `streams`, `official` links and `reconstruction` (SIMULATED profile, when the pad is known) |
| `GET /api/launches/ics` | `id` (single) or `operator` | `text/calendar` (RFC 5545), UTC times, `REFRESH-INTERVAL` 1 h |
| `POST /api/launches/refresh` | `Authorization: Bearer $ADMIN_TOKEN` (no token needed in dev) | Forces a refresh within quota. 403 otherwise |
| `GET /api/push/vapid` | none | `{ configured, publicKey? }` |
| `GET /api/subscriptions` | `clientId` (uuid) | Active subscriptions for that anonymous client |
| `POST /api/subscriptions` | `{ clientId, channel: "webpush"\|"inapp", scope: "launch"\|"operator"\|"all", target?, leadMinutes?: number[] (≤4, 1–1440), notifyChanges?, push?: PushSubscriptionJSON }` | Created subscription (zod-validated) |
| `DELETE /api/subscriptions` | `{ clientId, id? }` | Deactivates one, or all for the client |
| `GET /api/notifications` | `clientId` | In-app inbox (newest first) |
| `POST /api/notifications` | `{ clientId, ids? }` | Marks read |
| `GET /api/satellites` | `group=stations\|visual\|gps-ops\|galileo\|weather\|noaa\|science\|starlink\|last-30-days` | `data: OMM/GP JSON records` (PREDICTED; propagate client-side) |
| `GET /api/flights` | `lamin,lomin,lamax,lomax` (≤400 sq°), `mode=demo` | `data: { time, states[], bbox }`. LIVE from OpenSky, or SIMULATED in demo mode. Always includes `swim` status |
| `GET /api/streetlights` | `s,w,n,e` (≤0.05 sq°) | `data: {id,lat,lon,tags}[]` (HISTORICAL OSM street lamps; not lighting state) |
| `GET /api/search` | `q`, `places=0` to skip geocoding | `data: {type,label,sub,href}[]` across launches, sites, satellites and places (Nominatim) |

## `GET /api/imagery`

Envelope `{ provider, attribution, dataClass, fetchedAt, ageSeconds, stale, notice?, data: { items: ImageryItem[], total, sol?, latestSol?, query? } }`.

- `?target=mars&source=rover&rover=perseverance|curiosity[&camera=<id>][&sol=<n>|latest]` returns raw rover images (DELAYED). Without `sol`, it lists the latest sol that has images, and `data.latestSol` is set.
- `?target=<moon|mercury|venus|mars|jupiter|io|europa|ganymede|callisto|saturn|titan|enceladus|uranus|neptune|pluto>&source=archive[&q=<query id>][&page=1..20]` returns NASA Image and Video Library results (HISTORICAL).
- `ImageryItem` fields: `id, source, target, title, mission, instrument, date (UTC ISO), dateKind (acquired|created), sol, thumb, large, full, pageUrl, credit, description, kind (raw|photo|illustration|processed), rightsNote, dataClass`.
- Errors: `400` for parameters outside the allowlist. `502`/`503` with `dataClass: "UNAVAILABLE"` and an empty list when upstream fails, with `Retry-After` when backing off.

## Deep links

- `/sky?gallery=<target>[&source=rover|archive][&rover=curiosity][&q=<query id>]` opens the Surface & Mission Imagery gallery. `/sky?body=Mars&gallery=1` also works.

- `/earth?lat=&lon=&alt=&label=`: fly to a point. `/earth?pad=<launchId>` flies to the pad. `&recon=1` adds the SIMULATED ascent reconstruction.
- `/launches/<id>`: mission detail.
- `/orbit?sat=25544`: select a satellite by NORAD ID.
- `/sky?body=Mars`, `/sky?hip=32349`, `/sky?con=Ori`: select and centre a body, star or constellation.
