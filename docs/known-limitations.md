# Known limitations

This is an honest list of what is partial, stubbed or missing in this build.

## Data and providers

- **FAA SWIM** is a stub and always reports **UNAVAILABLE**. A real feed needs an approved FAA SCDS subscription and a Solace JMS consumer, which isn't implemented. US flight data comes from OpenSky only.
- **NASA and SpaceX "adapters"** only provide links derived from LL2 records (info and video URLs). No official schedule is scraped.
- **OpenSky anonymous** access is rate-limited, gives roughly 10 s resolution and allows no historical queries. With OAuth credentials the poll interval drops to 6 s. Coverage depends on the volunteer ADS-B network.
- **LL2 without a token** gets about 12 calls per hour in production, so the server budgets the calls and countdowns may lag a NET change by up to about 15 minutes. Dev uses lldev, whose data may differ from production.
- **Overpass** public endpoints are slow and sometimes overloaded. Street-lamp requests can time out (55 s) and are then shown as UNAVAILABLE.
- **Satellite data**: CelesTrak groups are cached for 2 h. Positions are SGP4 PREDICTED values, and accuracy degrades with TLE age (shown in the UI).

## Features

- **3D buildings and terrain** in EARTH need your own `NEXT_PUBLIC_CESIUM_ION_TOKEN`. Without it the globe is an ellipsoid with OSM or GIBS imagery.
- **Simulated city vehicles** (spec Phase VIII) are **not implemented**. Simulated aircraft exist only in Flights demo mode.
- **Webcams** are a curated directory of 7 official portals (links only). Nothing is embedded or claimed live.
- **Ascent reconstructions** on launch pages are generic SIMULATED gravity-turn profiles, not telemetry.
- **ASCENT** uses a point-mass vehicle with no attitude dynamics, aerodynamic torques, heating or landing. Pitch and heading are commanded directly. Earth rotation is modelled in drag and launch velocity; J2 isn't modelled.
- **Push notifications** need VAPID keys and a browser with Push API support. iOS needs the PWA installed to the home screen. The scheduler is in-process, so on serverless hosting use an external cron hitting `POST /api/launches/refresh`. The queue is processed on the 60 s tick.
- **Sky**: no atmospheric refraction, light pollution or deep-sky objects. Stars go to magnitude 6 only.
- **Mobile**: layouts are responsive, but the 3D views are tuned for desktop GPUs. Use the Low quality preset on phones.
- **Accessibility**: keyboard navigation, aria labels and reduced motion are supported. The 3D canvases have text alternatives in their side panels, but full screen-reader parity isn't there yet.
- **E2E tests**: Playwright is used for screenshots only, not assertions. Unit and integration coverage is in Vitest.
