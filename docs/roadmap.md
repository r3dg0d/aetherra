# Roadmap

1. **FAA SWIM SCDS consumer**: a Solace JMS worker that ingests TFMS/STDDS flight data into the DB, exposed via `/api/flights` with a DELAYED class.
2. **Simulated city vehicles**: an OSM road graph from Overpass with an agent-based traffic sim, rendered as instanced meshes in EARTH and clearly labelled SIMULATED.
3. **External scheduler**: split the 60 s tick into a worker process or cron for serverless deployments. Add a Postgres `LISTEN/NOTIFY` fan-out.
4. **Launch telemetry overlays**: where operators publish official webcast telemetry, show it as DELAYED with the source cited. Otherwise keep the SIMULATED reconstructions.
5. **Sky additions**: refraction, a Messier/NGC catalogue, satellite pass overlays in the planetarium, and AR mode with device orientation.
6. **ASCENT**: attitude dynamics with gimbal control, J2, booster landing, a mission editor and replays of real launch profiles where data allows.
7. **Playwright E2E assertions** in CI, Lighthouse budgets and visual regression on the screenshots.
8. **i18n and units** (imperial/metric toggle), plus offline PWA caching for catalogues and textures.
