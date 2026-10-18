# AETHERRA — Roadmap and Agent Working Rules

> Companion to `FEATURES.md` (what exists). This file: where the project is, what is next, and how agents must work.
> Status key: **done** = implemented and covered as described in `FEATURES.md`; **partial** = usable subset shipped; **todo** = not started; **stub** = placeholder that reports UNAVAILABLE honestly.

## Current state

- Shipped and verified on `main`: Explore/Home, Sky planetarium + planetary imagery, Earth (Cesium/GIBS), Orbit (SGP4), Flights (OpenSky + SIMULATED demo), Launches/Mission Control (DB pipeline, change alerts, reminders, ICS), ASCENT simulator (in-browser orbit verified), AETHERRA Voice, universal search, time machine, quality/sound/mobile passes, status page.
- Last verified (2026-10-17): ESLint 0 errors, `tsc` clean, 108 unit tests, Playwright 106 passed / 6 skipped by design / 0 failed, `next build` green; production server restarted on the box at :3000 after each feature.
- Latest feature commit before this document: `596c89d` (Voice). This roadmap ships in the docs commit that adds `FEATURES.md` + `ROADMAP.md`; run `git log --oneline -1` for its hash. Do not hard-code future hashes.
- Working model so far: development happens in `/workspace/aetherra` on the box; Vincent syncs box → NixOS machine → GitHub. Agents on the box **do not push**.

## Principles (non-negotiable)

1. **Data honesty.** Every value carries one of LIVE / DELAYED / HISTORICAL / PREDICTED / SIMULATED / UNAVAILABLE (`src/lib/classification.ts`). Never present simulated, predicted or stale data as live; never fabricate an API response, launch, image or countdown.
2. **No fake buttons.** A control either works end-to-end or is labelled (SIMULATED / UNAVAILABLE / links-only). Failure states are shown, not hidden.
3. **Green per milestone.** Each milestone ends with lint + typecheck + unit tests + `next build` passing, relevant e2e run, and a commit. Visual/mobile features also update screenshots.
4. **Providers are adapters.** All upstream access goes through `src/providers/*` with metadata, caching, backoff and quota discipline (see "Engineering rules").
5. **Secrets stay server-side.** Only `NEXT_PUBLIC_*` may reach the browser. Never commit `.env.local` or any secret (`.gitignore` covers `.env*`; keep it that way).
6. **Verify sources live before building on them.** Record what responded, what timed out, and what is dead (precedent: `api.nasa.gov/mars-photos` is dead; Curiosity RSS times out).

## Phased backlog vs the master prompt

The master prompt text is not stored in this repo; phase labels below follow the build order evidenced in the code, commits and `docs/known-limitations.md` (which cites "spec Phase VIII"). Treat the mapping as the project's working interpretation, not a quote.

| Phase | Scope | Status | Notes / gaps |
|---|---|---|---|
| I | Foundation: app shell, data-honesty system, provider pattern, Home/Explore Earth | **done** | Intro/quality/sound added later; static cloud composite is illustrative only |
| II | Sky planetarium (catalogue, constellations, ephemeris, observers, time) | **done** | Partial leftovers: no refraction, light pollution, deep-sky catalogue, pass overlays, AR |
| III | Earth: Cesium globe, GIBS imagery, sites, streetlights | **partial** | Buildings/terrain only with Cesium ion token; streetlights depend on flaky Overpass; webcam embeds not done (links only) |
| IV | Orbit: CelesTrak + SGP4 tracking, worker propagation | **done** | Accuracy bounded by element age; no manoeuvre/decay modelling |
| V | Flights: OpenSky live traffic, predicted tracks | **partial** | FAA SWIM stub (UNAVAILABLE); no historical playback; anonymous-rate limits apply |
| VI / Mission Control §29 | Launches: LL2 pipeline, countdowns, detail pages, change alerts, reminders (push+inbox), ICS, status | **partial** | Core done. Not done: verified real-device Web Push delivery, external scheduler split, special-event experiences, archive playback (see Next up) |
| VII | ASCENT simulator | **done (v1)** | Partial leftovers: attitude dynamics, J2, landing, mission editor, real-profile replays |
| VIII | City layer: streetlights + simulated city vehicles | **partial** | Streetlights done; simulated city vehicles **todo** (must be labelled SIMULATED) |

Also shipped outside the phase list: planetary imagery (Sky), AETHERRA Voice, universal search, quality presets/dynamic resolution, synthesized sound, hide-UI screenshot mode, Playwright audit suite.

## Next up (ordered; each item needs its acceptance criteria met before it counts as done)

### 1. Real-device GPU performance pass
- Run Home/Sky/Orbit/Flights/ASCENT on at least one real phone GPU and one desktop GPU; record FPS + frame p50/p95 per quality tier in `docs/known-limitations.md`.
- Acceptance: Auto tier reaches a stable ≥30 FPS on the phone for Home/Orbit/ASCENT (or the tier table is adjusted until it does); SwiftShader numbers are no longer the only perf data; e2e audit still green.

### 2. Web Push real-delivery verification
- With VAPID keys configured, subscribe from a real browser (desktop + installed-PWA phone), trigger a reminder (test launch or lead-time override), confirm delivery, change-alert and click-through; document the result.
- Acceptance: delivery observed end-to-end (or the blocker identified and Push downgraded in UI/docs to "best effort, unverified"); inbox fallback covered by a test either way; no subscription created silently (user gesture + confirmation only).

### 3. Streetlights reliability, then simulated city vehicles (Phase VIII completion)
- Streetlights: add retry/secondary Overpass endpoint handling and cached-tile fallback so the layer degrades to stale-labelled data instead of UNAVAILABLE where possible.
- Vehicles: OSM road graph via Overpass, agent traffic rendered as instanced meshes in EARTH.
- Acceptance: vehicles visibly move on roads in EARTH, always labelled SIMULATED (badge + docs); streetlight layer shows its class/staleness at all times; e2e asserts the SIMULATED label; perf within the quality-tier budget from item 1.

### 4. Cesium ion 3D buildings/terrain (opt-in path polished)
- With `NEXT_PUBLIC_CESIUM_ION_TOKEN` set, enable World Terrain + OSM Buildings with a Settings toggle and attribution; keep the no-token ellipsoid path default.
- Acceptance: toggle works with and without a token; without a token the UI says why buildings are unavailable (no silent absence); screenshots both ways; token never logged or sent anywhere except Cesium.

### 5. Webcam embeds where terms allow
- Per-source check of embed terms for the 7 directory portals; embed only where explicitly allowed, otherwise keep links.
- Acceptance: a written per-source decision in `docs/providers.md`; embeds only for allowed sources, still click-to-load (no autoplay/third-party requests on page load); directory links remain for the rest.

### 6. Historical launch archive playback
- Use the previous-launches data already ingested to build a browsable archive with time-machine playback of past missions (positions/reconstruction only where labelled SIMULATED).
- Acceptance: past launches searchable/filterable; playback uses HISTORICAL for schedule data and SIMULATED for any reconstructed path; no invented telemetry; e2e covers one archived mission.

### 7. Starship / Artemis special launch experiences
- For major LL2 missions (Starship, Artemis), a dedicated detail experience: official links/streams, mission timeline from LL2 fields, countdown states.
- Acceptance: driven only by real LL2 fields (nothing hand-typed per mission beyond a mission-id allowlist); absent fields degrade to the standard detail page; SIMULATED labels on any reconstruction.

### 8. VR / WebXR investigation (spike, not a feature)
- Time-boxed prototype: WebXR session entering the existing Sky or Home three.js scene.
- Acceptance: a written go/no-go note (device support, perf from item 1, input model); no user-facing entry point unless the note says go and a follow-up task is accepted.

### 9. Public deploy
- Decide hosting (box/NixOS self-host vs serverless), external scheduler (cron hitting `POST /api/launches/refresh`), Postgres, VAPID + ADMIN_TOKEN provisioning, quota review.
- Acceptance: a deploy doc with env checklist; production LL2 quota respected under real traffic; `/status` shows all providers healthy or honestly degraded; rollback = previous commit + restart.

### Backlog (unprioritised)
FAA SWIM SCDS consumer (needs approved subscription); ASCENT attitude dynamics/J2/landing/mission editor; Sky refraction + Messier/NGC + satellite-pass overlays; launch telemetry overlays only from official sources (DELAYED); i18n + metric/imperial toggle; offline PWA caching of catalogues/textures; LROC/JunoCam direct feeds if an official JSON appears; visual-regression diffs on screenshots in CI.

## Engineering rules for agents

- **Where code lives:** pages `src/app/<mode>/`, mode UI `src/components/<mode>/`, shared shell `src/components/shell/`, pure logic `src/lib/<area>/` (astro, orbit, ascent, flights, voice, audio, store), providers `src/providers/<name>/`, API routes `src/app/api/<name>/route.ts`, DB `src/server/db/`, SGP4 worker `src/workers/sgp4.worker.ts`, catalogues `public/data/`, tests `test/*.test.ts` (unit) and `e2e/*.spec.ts` (Playwright), scripts `scripts/*.mjs`, screenshots `screenshots/<set>/`.
- **Read first:** `FEATURES.md`, `docs/architecture.md`, `docs/providers.md`, `docs/known-limitations.md`, and the provider/core files listed there.
- **Adding a provider:** create `src/providers/<name>/adapter.ts`; `registerProvider(meta)` with operator/homepage/license/attribution/dataClass/expectedRefreshSeconds/envVars/rateLimit; fetch via `fetchJson` (timeout/retries/Retry-After/circuit breaker), wrap in `cached`, expose through a route returning `envelope(...)`; import the adapter in `src/app/api/providers/route.ts`; add fixture-based normalization tests; document it in `docs/providers.md` + attribution. Parameters forwarded upstream must be allowlisted, never raw user input.
- **Adding a feature:** UI in the mode's components, pure logic in `src/lib`, state in the existing Zustand stores (`app`, `time`, `view`), data classes on anything user-visible, unit tests for pure logic, e2e for user flows, screenshots for visual changes, docs updated in the same commit series.
- **Commit conventions:** work on `main` in `/workspace/aetherra` (box copy); small milestone commits with imperative summaries (see `git log`); keep lint/typecheck/unit/e2e/`next build` green at each commit; never commit `.env.local`, secrets, `test-results/`, or `.next/`; screenshots and fixtures are committed deliberately, not accidentally.
- **Sync flow:** agents finish on the box (commit + prod restart on :3000 when the task asks). **Vincent** syncs box → NixOS machine → GitHub (`gh`). Agents do not push, open PRs, or touch the NixOS machine unless a task explicitly says so.
- **Running services on the box:** prod is `npm run build && npm start` on :3000 (log `/tmp/aetherra-prod.log`); a dev server (lldev launches) must not be left writing into the shared Postgres — if one was used, expire the `ll2:%` snapshots so prod refetches production LL2 before finishing.
- **Testing expectations:** e2e needs a running server (`BASE_URL`); it uses system Chrome + SwiftShader, so WebGL frame numbers are a floor. Label any test that must skip when a live upstream is down (UNAVAILABLE state is a pass, fabricated data is not).

## Open questions / risks

- **API quotas:** LL2 anonymous ≈12 calls/h in production (token raises limits); OpenSky anonymous rate/resolution limits; Overpass public endpoints are best-effort and slow; CelesTrak asks ≤1 download per group per ~2 h. Any deploy or traffic growth must re-budget these first.
- **Licensing/terms:** NASA media is broadly reusable with credit, but individual library items can carry third-party rights (incl. CC BY) — per-item credit/rights notes must be preserved. JunoCam citizen-processed images need processor credit. OSM data is ODbL (attribution required); Nominatim/Overpass usage policies cap heavy use. Cesium ion content is under ion terms and needs a token. OpenSky is non-commercial/research-oriented. Webcam or livestream embeds are per-operator decisions, not assumptions.
- **Browser APIs:** Web Speech recognition availability and behaviour are vendor-controlled (and usually server-backed by the vendor); Firefox lacks it. Web Push on iOS requires an installed PWA. Both must keep honest fallbacks.
- **Data freshness vs cost:** countdown accuracy is bounded by the LL2 refresh cadence under quota; a paid/token tier or deploy-time budget change alters this and must be reflected in the UI's staleness labels.
- **Unverified areas:** real-device GPU performance, real Web Push delivery, behaviour under public traffic, and long-running scheduler reliability are all unproven (see Next up items 1, 2, 9).
