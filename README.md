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
npm run e2e            # Playwright against BASE_URL (default http://localhost:3000): desktop 1280x800, iPhone 390x844, Android 412x915, iPad 820x1180
npm run screenshots:polish   # desktop + mobile shots into screenshots/polish/
```

The e2e suite checks navigation, search, layer toggles, mute persistence, hide-UI mode and touch controls. It also runs a per-page audit on every viewport: no horizontal scroll, no console errors, tap targets ≥ 44 px on touch, and rAF frame timing written to `test-results/audit/`. It flies ASCENT to orbit in the browser with assist and time warp.

- **Database:** with `DATABASE_URL` the app uses Postgres via Drizzle. Without it, it falls back to embedded PGlite in `./.data/pglite`. Migrations in `drizzle/` run automatically.
- **Push:** Web Push needs VAPID keys (`npx web-push generate-vapid-keys`). Without them, reminders still land in the in-app inbox.
- **Scheduler:** an in-process scheduler (`src/instrumentation.ts`) refreshes launches within the LL2 rate budget, enqueues reminders and change alerts, and delivers them every 60 s. Disable it with `AETHERRA_SCHEDULER=off`.

## Visuals, sound and mobile

- **Quality presets:** Low, Medium, High, Ultra or Auto, in Settings. Each preset sets DPR range, texture size, clouds, bloom, star magnitude, sphere segments, Milky Way and particle counts. Auto picks a starting tier from the device and adjusts resolution with a frame-rate monitor. A dev perf panel (FPS, p50/p95 frame time, draw calls, triangles, DPR, heap) can be switched on in Settings.
- **Intro:** a logo fade, then a cinematic orbit into the Earth. It plays once per session and can be skipped with any input or the "Skip intro" button. It's skipped entirely under reduced motion or with `?nointro`.
- **Screenshot mode:** `H` (or `U`) hides all UI. `Esc` or the "Show interface" button restores it. On ASCENT, use `U` because `H` isn't bound there.
- **Sound:** every sound is synthesized live with the Web Audio API, so the app ships no audio files. It's muted by default. Nothing plays until you unmute, and the audio context only starts after a user gesture. Mute and volume persist. Sounds include UI ticks, an ambient drone per mode, an ASCENT engine rumble that follows throttle and dynamic pressure, countdown beeps and a staging thunk. Reduced motion ("calm mode") turns off drones and softens ticks. **Sound is cinematic, not a model of acoustics in space.**
- **Mobile:** below 1024 px the nav collapses into a menu. Below 768 px the side panels become bottom sheets. Safe-area insets are respected, and touch targets are 44 px on coarse pointers. The globe and sky take drag and pinch. ASCENT adds an on-screen attitude pad, a throttle slider and LAUNCH/STAGE, assist, warp, camera and map buttons.

## Planetary imagery (SKY)

Select the Moon or a planet in SKY and press **Surface & Mission Imagery**. You can also search "Mars rover photos" or "Jupiter Juno", or open `/sky?gallery=mars`.

- **Mars:** Perseverance and Curiosity raw images straight from NASA/JPL's feeds (DELAYED, labelled raw/uncalibrated). Filter by rover, camera and sol; the latest sol is the default.
- **Moon, planets and moons:** curated mission queries against the NASA Image and Video Library (HISTORICAL). Illustrations are flagged and hidden by default.
- **Lightbox:** mission, instrument, UTC date, sol, image ID, source, credit, rights note and an official link. Use ←/→, swipe and Esc to navigate.

`npm run screenshots:imagery` captures the gallery shots. Source details are in [docs/providers.md](docs/providers.md#planetary-imagery-notes).

## Keyboard

- **Global:**
  - `⌘K` or `/`: search
  - `H` or `U`: hide UI
  - `Esc`: show UI
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
