# AETHERRA: The Living Atlas of Earth and Space

AETHERRA is a cinematic, data-honest web atlas. It shows the real sky, Earth, satellites, aircraft and rocket launches, plus a playable orbital ascent simulator. Every number on screen carries a provenance class: **LIVE**, **DELAYED**, **HISTORICAL**, **PREDICTED**, **SIMULATED** or **UNAVAILABLE**. Simulated data is never shown as live.

| Mode | What it does | Data |
|---|---|---|
| **Explore** (`/`) | A 3D Earth with real day/night, city lights, the Sun, the Moon at true scaled distance, stars rotated by sidereal time, the ISS from SGP4 and the next launch countdown | astronomy-engine (PREDICTED), CelesTrak (PREDICTED), LL2 (LIVE) |
| **Sky** (`/sky`) | A fisheye planetarium for any observer/time: 5,044 stars (Hipparcos via d3-celestial), 88 constellations, Sun/Moon/planets, rise/set, inspect panel | Computed locally |
| **Earth** (`/earth`) | A CesiumJS globe with OSM, NASA GIBS daily imagery (date picker, split compare), launch sites, OSM street lamps, official webcam directory, deep links | GIBS, OSM, Overpass |
| **Orbit** (`/orbit`) | Satellite groups propagated with SGP4 in a Web Worker, ground tracks, orbit lines, search, pass predictions for your observer | CelesTrak GP |
| **Flights** (`/flights`) | OpenSky state vectors with dead reckoning (solid = observed, dashed = predicted), an aircraft panel and a clearly labelled SIMULATED demo mode | OpenSky; FAA SWIM stub = UNAVAILABLE |
| **Launches** (`/launches`) | Mission Control: real launches, precision-aware countdowns, filters, history, ICS calendar, in-app inbox, Web Push reminders, change detection (NET slips, scrubs, status) | Launch Library 2 |
| **Ascent** (`/ascent`) | Fly the fictional two-stage AETHER-1 to orbit: RK4 physics, gravity, drag, staging, apo/peri HUD, assist autopilot, camera modes, map view | SIMULATED |

## Quick start

```bash
npm install            # also copies Cesium static assets to public/cesium
cp .env.example .env.local   # optional; everything has a fallback
npm run dev            # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

Checks:

```bash
npm run lint && npm test && npm run typecheck
npm run screenshots    # needs a running server and Chrome at /usr/bin/google-chrome (CHROME_PATH to override)
```

- **Database:** with `DATABASE_URL` the app uses Postgres via Drizzle. Without it, it falls back to embedded PGlite in `./.data/pglite`. Migrations in `drizzle/` run automatically.
- **Push:** Web Push needs VAPID keys (`npx web-push generate-vapid-keys`). Without them, reminders still land in the in-app inbox.
- **Scheduler:** an in-process scheduler (`src/instrumentation.ts`) refreshes launches within the LL2 rate budget, enqueues reminders and change alerts, and delivers them every 60 s. Disable it with `AETHERRA_SCHEDULER=off`.

## Keyboard

- **Global:** `⌘K` or `/` opens search.
- **Ascent:**
  - `Space`: countdown, then staging
  - `Shift`/`Ctrl`: throttle up/down. `Z`/`X`: full/cut
  - `W`/`S`: pitch. `A`/`D`: heading
  - `P`: assist
  - `C`: camera
  - `M`: map
  - `,` `.`: time warp
  - `R`: reset
  - `Esc`: pause

## Docs

- [Architecture](docs/architecture.md)
- [Providers](docs/providers.md)
- [API contracts](docs/api.md)
- [Privacy](docs/privacy.md)
- [Attribution & licences](docs/attribution.md)
- [Known limitations](docs/known-limitations.md)
- [Roadmap](docs/roadmap.md)

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4, Zustand
- three.js with @react-three/fiber and drei
- CesiumJS
- astronomy-engine and satellite.js
- Drizzle ORM (Postgres / PGlite), zod, web-push
- Vitest, Playwright (screenshots)
