# AETHERRA — Feature Inventory (for agents and engineers)

> Factual snapshot of the code on `main`. Verify before quoting: `git log --oneline -1`, `npx vitest run`, `npx playwright test --list`.
> Tagline: **From Streetlight to Starlight.**
> One-line summary: a Next.js/TypeScript web app that combines a 3D Earth, a computed planetarium, satellite tracking (SGP4), aircraft tracking, a Launch Library 2 mission-control surface, a playable orbital-ascent simulator, NASA planetary imagery, and a push-to-talk voice assistant — with every datum labelled by provenance class.

## Modes

| Route | Mode | Purpose | Typical data class(es) | Provider / source |
|---|---|---|---|---|
| `/` | Explore (Home) | 3D Earth: real day/night, city lights, clouds, Sun/Moon, stars by sidereal time, ISS marker, next-launch countdown card, cinematic intro | LIVE / PREDICTED (computed) | Astronomy Engine (local), CelesTrak (ISS elements), LL2 (countdown card) |
| `/sky` | Sky | Planetarium for any observer/time: stars, constellations, planets, rise/set, inspect panels, imagery galleries | PREDICTED (ephemeris/catalogue); imagery DELAYED/HISTORICAL | Astronomy Engine; NASA/JPL rover feeds; NASA Image & Video Library |
| `/earth` | Earth | CesiumJS globe: GIBS daily imagery layers, date scrub + split compare, launch sites, streetlights (OSM), webcam directory (links) | HISTORICAL (daily imagery, OSM) | NASA GIBS, OpenStreetMap/Overpass, Cesium ion (optional) |
| `/orbit` | Orbit | Satellite groups propagated client-side (Web Worker), orbit/ground tracks, satellite search, pass info, cinematic fly-to | PREDICTED | CelesTrak GP elements + satellite.js SGP4 |
| `/flights` | Flights | Aircraft map: observed tracks solid, dead-reckoned prediction dashed (≤90 s); follow view; demo mode | LIVE/DELAYED; SIMULATED in demo | OpenSky Network; AETHERRA demo generator |
| `/launches` | Launches (Mission Control) | Upcoming/previous launches, countdowns with NET precision, filters, detail pages, reminders, ICS export, change history, official/stream links, SIMULATED reconstruction profile | LIVE/DELAYED/HISTORICAL; reconstructions SIMULATED | Launch Library 2 (LL2); DB-backed (Postgres or PGlite) |
| `/launches/[id]` | Launch detail | Mission detail, patches, streams, links, reminder button, ICS, reconstruction plot | as above | LL2 |
| `/ascent` | ASCENT | Playable two-stage launch simulator: RK4 physics, staging, time warp, assist autopilot, plume particles, touch controls | SIMULATED | `src/lib/ascent/physics.ts` (local) |
| `/status` | Status | Provider health, staleness, data classes, static source list, attribution summary | mixed | `GET /api/providers` + registry |

## Feature inventory by area

- **Home/Explore** (`src/app/HomeClient.tsx`, `src/components/globe/*`): shader Earth (Fresnel atmosphere, terminator, city lights dimmed by clouds, ocean glint), cloud sphere (static NASA Blue Marble composite, toggleable), Milky Way band (procedural, true galactic orientation), starfield with HDR bright stars, Sun/Moon, ISS marker, intro sequence (logo → cinematic orbit; interruptible; skipped with reduced motion or `?nointro`; once per session), hide-UI mode (`H`/`U`, Esc restores).
- **Sky planetarium** (`src/components/sky/*`): 2D canvas all-sky chart; 5,044-star catalogue to mag 6 (`public/data/stars.json`, Hipparcos via d3-celestial); all 88 constellations; Sun/Moon/planets via Astronomy Engine; observer presets + manual coordinates + geolocation (browser-only); conditions panel (sky state, Sun altitude, Moon phase); toggles: constellation lines, labels, alt-az grid, stars-in-daylight, magnitude limit; inspect panels (star/body/constellation) with rise/transit/set; deep links `?body=`, `?hip=`, `?con=`, `?layers=`; time machine integration.
- **Planetary imagery** (`src/components/imagery/*`, `src/providers/planetary-imagery/*`): "Surface & Mission Imagery" gallery for 15 targets (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Io, Europa, Ganymede, Callisto, Titan, Enceladus).
  - Mars rover tab: Perseverance (`mars2020` RSS JSON) and Curiosity (`raw_image_items`) raw images, rover/camera/sol filters, latest sol by default, first 48 items of a sol, labelled RAW · UNCALIBRATED, data class DELAYED.
  - Archive tab: curated mission queries against NASA Image & Video Library (HISTORICAL); items classified PHOTO / ILLUSTRATION (hidden by default) / PROCESSED; per-item credit, rights notes (incl. CC BY), official-page and full-resolution links; lightbox with keyboard/swipe navigation; image hosts allowlisted (`mars.nasa.gov`, `images-assets.nasa.gov`; CSP `img-src` on `/sky`); honest empty/UNAVAILABLE states.
- **Earth/Cesium+GIBS** (`src/components/cesium/*`): Cesium viewer; base layers OSM or GIBS; GIBS daily layers with date control and split-screen compare; launch-site markers and fly-to; streetlights from Overpass (bbox-capped, HISTORICAL, lamp locations not lighting state); webcam directory = 7 official portal links only (no embeds); deep links `?lat&lon&alt&label`, `?pad=`, `?recon=`.
- **Orbit/SGP4** (`src/components/orbit/*`, `src/workers/sgp4.worker.ts`): CelesTrak groups (stations, visual, gps-ops, galileo, weather, noaa, science, starlink, last-30-days); propagation in a worker; orbit lines (smoothed trails), ground tracks; search by name/NORAD; `?sat=<norad>` deep link; pass/position readouts; cinematic fly-to transitions.
- **Flights** (`src/components/flights/*`): OpenSky states polled by camera bbox (≤400 sq°); extrapolated motion between polls; observed vs predicted rendering; flight detail; `?lat&lon` centring (used by Voice); demo mode with seeded synthetic traffic, labelled SIMULATED; FAA SWIM status displayed as UNAVAILABLE (stub).
- **Launches / Mission Control** (`src/components/launches/*`, `src/providers/launches/*`): DB ingestion pipeline (LL2 upcoming 15-min TTL / previous 2-h TTL, hourly quota in `provider_snapshots`, zod validation — failed/invalid fetches never delete rows); normalized launches; change detection (NEW, NET_CHANGED, SCRUBBED, STATUS_CHANGED, WINDOW_CHANGED, LAUNCHED) with dedupe keys and out-of-order protection; countdowns honoring NET precision (estimates never shown as exact); filters (operator, search, country/window); detail pages with timeline, media/patches, official and stream links; **notifications**: subscriptions (scope launch/operator/all, lead minutes ≤4, change alerts), Web Push (VAPID) with in-app inbox fallback, notification centre, unsubscribe; **ICS**: `/api/launches/ics?id=` or `?operator=` calendar export; SIMULATED ascent reconstruction when the pad is known; scheduled 60 s in-process tick (`src/instrumentation.ts`; disable with `AETHERRA_SCHEDULER=off`) for refresh/reminders/queue; `POST /api/launches/refresh` (Bearer `ADMIN_TOKEN` in prod) for external cron.
- **ASCENT physics** (`src/lib/ascent/*`, `src/components/ascent/*`): ECI point-mass gravity, exponential atmosphere, co-rotating drag, sea-level/vacuum Isp interpolation; RK4 fixed dt=0.02 s with accumulator (frame-rate independent); time warp capped at 4× while thrusting or below 100 km; staging; orbit = e<1 and periapsis >140 km; assist autopilot (gravity turn; targets periapsis >160 km cutoff); verified end-to-end (unit: energy/angular-momentum conservation and assisted insertion ≈175×221 km; e2e: in-browser ORBIT ACHIEVED). HUD: MET, altitude, velocity, apoapsis/periapsis, dynamic pressure, propellant; exhaust plume particles, altitude-based sky darkening, touch controls (attitude pad, throttle slider, launch/stage/warp/camera/map), keyboard controls, map view. No attitude dynamics, aero torques, heating, landing, or J2.
- **Voice assistant** (`src/components/voice/*`, `src/lib/voice/*`): "AETHERRA Voice", SIMULATED persona label; push-to-talk only (recognition object is created only after a mic tap; no wake word, no always-listening); Web Speech recognition/synthesis where available; honest UNSUPPORTED state (e.g. Firefox) with an always-working typed command box; panel shows transcript, intent, parser confidence (+ ASR confidence), action, and text reply; pure parser (`intents.ts`) intents: navigate, find body/constellation/satellite/star/place (reuses universal search destinations), imagery, next-launch (LL2 only, never invented; UNAVAILABLE when down), remind-next/remind-all (explicit confirmation first, existing subscription flow), flights-near (geocodes, centres `/flights`), tonight summary (computed ephemeris, PREDICTED), time controls, Sky layer toggles, help, unknown-with-suggestions. Settings: voice replies on/off, rate 0.6–1.5, pitch 0.5–1.6; suppressed by global mute and reduced motion (reason shown). Privacy facts: AETHERRA receives/stores no audio; the browser vendor's speech service may process audio (stated in UI and `docs/voice.md`).
- **Universal search** (`src/components/shell/SearchPalette.tsx`, `GET /api/search`): ⌘K or `/`; local results (bodies, constellations, named stars, pages, imagery galleries) + server results (launches from DB, satellites from CelesTrak stations group, places via Nominatim); keyboard navigation; selecting a result performs the same navigation Voice uses (including same-page `/sky?…` handling).
- **Time machine** (`src/components/shell/TimeControls.tsx`, `src/lib/store/time.ts`): LIVE / pause / play at speeds −3600×…86400×, ±1 h steps, +1 d, arbitrary datetime; drives Sky/Orbit/Home computed views; classification via `timeClass` (LIVE near now, else HISTORICAL/PREDICTED). ASCENT has its own warp controls.
- **Quality / sound / mobile / accessibility** (`src/lib/quality.ts`, `src/lib/audio/*`, `src/app/globals.css`): quality presets Low/Medium/High/Ultra/Auto (DPR range, texture size, clouds, bloom, AA, star magnitude limit, sphere segments, Milky Way, particle counts) with drei PerformanceMonitor dynamic resolution and Auto tier stepping (capped at High); dev perf panel (FPS, frame p50/p95, draw calls, triangles, DPR, heap). Sound: all synthesized via Web Audio (no audio files); muted by default until user unmutes (autoplay policy); per-scene ambient drones, UI ticks, ASCENT rumble tied to throttle/dynamic pressure, countdown beeps, staging thunk; cinematic only, not space acoustics. Mobile: nav collapses <1024 px; panels become bottom sheets <768 px; safe-area insets; 44 px targets on coarse pointers; pinch/drag on sky and globe; ASCENT touch controls. Accessibility: skip link, aria labels/roles, focus styles, `prefers-reduced-motion` + manual toggle (skips intro, instant camera, calms audio, silences voice replies); 3D canvases lack full screen-reader parity.
- **Status page** (`/status`, `GET /api/providers`): live provider states (ok/degraded/down/unconfigured/idle), last success/error, backoff, cache/snapshot summaries, env-var presence booleans (never secret values), static source list.

## Data-honesty system

Every surfaced datum carries exactly one class (`src/lib/classification.ts`), rendered by `DataBadge` and the status bar:

| Class | Meaning (as implemented) |
|---|---|
| LIVE | Received within the provider's expected refresh interval |
| DELAYED | Real data older than 3× the expected refresh, or intentionally delayed (e.g. raw rover images) |
| HISTORICAL | Archived real data for a past time (NASA library, GIBS daily, previous launches) |
| PREDICTED | Computed from a model (ephemeris, SGP4 propagation, dead reckoning) |
| SIMULATED | Synthetic AETHERRA data (ASCENT, demo flights, reconstructions, voice persona) |
| UNAVAILABLE | Not configured, unreachable, or no usable data |

Mechanics: provider responses are `ProviderEnvelope { provider, attribution, dataClass, fetchedAt, ageSeconds, stale, notice?, data }` (`src/providers/core/envelope.ts`). `classifyByAge` downgrades LIVE→DELAYED. Server fetches use timeouts, bounded retries with jitter, `Retry-After` handling, and a per-provider circuit breaker (`core/http.ts`, `core/registry.ts`). `core/cache.ts` coalesces in-flight requests and serves the last good value flagged `stale` on error. UI rule: failures show UNAVAILABLE + empty state, stale cache is labelled, simulated data is never presented as live, countdown precision is preserved. See `docs/providers.md`, `docs/known-limitations.md`.

## Provider adapters

All under `src/providers/`, each calling `registerProvider(meta, isConfigured)` with license/attribution/class/refresh/rate-limit metadata.

| Adapter | Upstream | Class | Env vars |
|---|---|---|---|
| `launches/ll2.adapter.ts` (+ service/normalize/changeDetector/queue/subscriptions/ics/push/livestream/reconstruction) | Launch Library 2 (`ll.thespacedevs.com`, dev: lldev) | LIVE/DELAYED/HISTORICAL | `LL2_BASE_URL?`, `LL2_API_TOKEN?`, `LL2_MAX_REQUESTS_PER_HOUR?` |
| `launches/nasa.adapter.ts`, `launches/spacex.adapter.ts` | links derived from LL2 records only (no scraping) | n/a (links) | none |
| `celestrak/adapter.ts` | CelesTrak GP JSON | PREDICTED | none |
| `opensky/adapter.ts` | OpenSky Network states | LIVE/DELAYED | `OPENSKY_CLIENT_ID?`, `OPENSKY_CLIENT_SECRET?` (anonymous works, slower poll) |
| `faa/swim.adapter.ts` | FAA SWIM SCDS | **UNAVAILABLE (stub)** | `FAA_SWIM_JMS_URL`, `FAA_SWIM_USERNAME`, `FAA_SWIM_PASSWORD`, `FAA_SWIM_QUEUE` (consumer not implemented) |
| `overpass/adapter.ts` | Overpass API (OSM street lamps) | HISTORICAL | `OVERPASS_URL?` |
| `nominatim/adapter.ts` | Nominatim geocoding | HISTORICAL | `NOMINATIM_URL?` |
| `gibs/layers.ts` | NASA GIBS WMTS (browser tiles) | HISTORICAL | none |
| `planetary-imagery/mars-raw.adapter.ts` | mars.nasa.gov raw feeds (Perseverance RSS JSON; Curiosity `raw_image_items`) | DELAYED | none |
| `planetary-imagery/nasa-ivl.adapter.ts` | images-api.nasa.gov | HISTORICAL | none |
| (client tiles) | OpenStreetMap tiles; Cesium ion terrain/buildings | HISTORICAL / — | `NEXT_PUBLIC_CESIUM_ION_TOKEN?` |

Other env (see `.env.example`, all optional): `DATABASE_URL` (else PGlite at `PGLITE_DIR`, default `./.data/pglite`), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (Web Push; without them reminders use the in-app inbox), `ADMIN_TOKEN` (prod refresh endpoint), `AETHERRA_SCHEDULER=off`. Only `NEXT_PUBLIC_*` reaches the browser.

## Commands

```bash
npm install            # postinstall copies Cesium assets to public/cesium
cp .env.example .env.local   # optional; never commit .env.local
npm run dev            # dev server (uses lldev for launches)
npm run build && npm start   # production build + server (default port 3000)
npm run lint           # eslint (0 errors; ~33 advisory warnings at last check)
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run e2e            # playwright test — needs a running server (BASE_URL, default http://localhost:3000; system Chrome via CHROME_PATH)
npm run screenshots    # base screenshots (scripts/screenshots.mjs)
npm run screenshots:polish    # screenshots/polish/
npm run screenshots:imagery  # screenshots/imagery/
npm run screenshots:voice     # screenshots/voice/
npm run catalogs       # rebuild public/data catalogues (scripts/build-catalogs.mjs)
npm run db:generate    # drizzle-kit generate (migrations in drizzle/, auto-applied at runtime)
```

## Architecture pointers (read first)

1. `README.md`, this file, `docs/architecture.md`, `docs/providers.md`, `docs/known-limitations.md`.
2. `src/lib/classification.ts` + `src/providers/core/{types,http,cache,registry,envelope}.ts` — the honesty plumbing every feature uses.
3. `src/providers/<name>/adapter.ts` + `src/app/api/<route>/route.ts` — provider → API pattern.
4. `src/lib/store/{app,time}.ts` — persisted settings, global clock; `src/lib/quality.ts` — rendering tiers.
5. Mode components: `src/components/{globe,sky,cesium,orbit,flights,launches,ascent,imagery,voice,shell}/`.
6. Pure cores with tests: `src/lib/{astro,orbit,ascent,flights,voice}/`, `src/providers/launches/{normalize,changeDetector,ics,countdown}.ts`.
7. Server: `src/server/http.ts`, `src/server/db/{client,schema}.ts`, `src/instrumentation.ts` (scheduler).

## Testing inventory (last verified 2026-10-17)

- **Unit (Vitest): 108 tests, 9 files** (`test/*.test.ts`): astronomy reference checks, coordinates, SGP4 vectors, ascent physics (conservation + orbit insertion), flight interpolation, launch pipeline (normalize/change detection/ICS/countdown/subscriptions), imagery normalization from recorded fixtures + failure/backoff/budget behaviour, audio/quality/intro math (`polish.test.ts`), voice intent parser (37-case utterance table).
- **E2E (Playwright): 112 tests, 5 files** (`e2e/*.spec.ts`) across 4 projects (desktop 1280×800, iPhone 390×844, Android 412×915, iPad 820×1180): functional assertions (nav, search, layer toggles, mute persistence, hide-UI, touch controls), imagery gallery (Mars/Moon/Jupiter/search), voice (mocked SpeechRecognition, typed fallback, unsupported state), ASCENT-to-orbit in browser, plus a per-page audit (no horizontal overflow, no console errors, ≥44 px tap targets on touch, rAF frame sampling → `test-results/audit/`). Last full run: **106 passed, 6 skipped by design, 0 failed** (headless SwiftShader; frame numbers are a floor, not device FPS).
- Note: `README.md`'s badges/text still say "71 unit + 79 e2e" — stale; use the numbers above.

## Known limitations

See `docs/known-limitations.md` (canonical). Summary: LL2 anonymous quota ≈12 calls/h in prod (NET changes can lag ~15 min); OpenSky anonymous ≈10 s resolution, no history; Overpass can time out (55 s) → UNAVAILABLE; CelesTrak cached 2 h and SGP4 accuracy degrades with element age; rover listings capped at 48 images/sol; library dates are record dates; Sky caps at mag 6 (no refraction/light-pollution/deep-sky); static cloud composite is not weather; Milky Way is stylised; sound is cinematic, not acoustic modelling.

## Not implemented / stubbed (explicit)

- **FAA SWIM**: adapter stub, always UNAVAILABLE; no SCDS/JMS consumer.
- **Simulated city vehicles** (master-prompt Phase VIII): not implemented. Only Flights demo aircraft are simulated.
- **Embedded webcams**: not implemented; directory of 7 official portal links only, nothing embedded or claimed live.
- **3D buildings/terrain**: only with a user-supplied Cesium ion token; otherwise ellipsoid + imagery.
- **Real Web Push delivery**: code path exists (VAPID subscribe, queue, `public/sw.js`), but end-to-end delivery to a real browser/device has **not** been verified in this environment; in-app inbox is the verified fallback.
- **Real-device performance**: unknown; all perf numbers come from headless Chrome/SwiftShader on the box.
- **LROC catalogue, direct JunoCam feed, Chang'e imagery**: not integrated (checked 2026-10-17; see `docs/providers.md`).
- **Old `api.nasa.gov/mars-photos` API**: dead upstream ("No such app"); not used.
- **ASCENT**: no attitude dynamics/J2/landing/mission editor.
- **Sky**: no refraction, light-pollution model, Messier/NGC catalogue, pass overlays, or AR/WebXR.
- **External scheduler/worker split**: scheduler is in-process only; serverless needs external cron against the refresh endpoint.
- **i18n / unit preferences / offline PWA caching**: not implemented.
