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
- **Planetary imagery**:
  - Rover listings show the first 48 images of a sol. Raw images are uncalibrated, and night or calibration frames can look like noise.
  - Library search relevance depends on NASA's metadata. Curated queries can still return spacecraft-processing photos.
  - Library dates are record dates, not always acquisition dates.
  - No LROC catalogue, direct JunoCam feed or Chang'e data.
- **Sky**: no atmospheric refraction, light pollution or deep-sky objects. Stars go to magnitude 6 only.
- **Mobile**: Playwright-audited at 390x844, 412x915 and 820x1180, with touch controls, bottom sheets and 44 px targets. Auto quality starts phones on Low. The audit couldn't run on real devices (no device farm here), so real-GPU frame rates are unmeasured.
- **Cloud layer**: a static NASA Blue Marble composite. It isn't live or current weather. Use the GIBS layers in EARTH for daily imagery.
- **Milky Way**: procedural and artistic. Its position is real (galactic plane and centre), but structure and brightness are stylised.
- **Sound**: cinematic and synthesized. Space is silent, and the rumble isn't a physical acoustic model.
- **Frame-rate numbers** from the e2e audit come from headless Chrome on SwiftShader (CPU rendering), so the WebGL pages report 2–30 FPS there. They're a regression signal, not a real-GPU benchmark. DOM pages hit 60 FPS.
- **Accessibility**: keyboard navigation, aria labels and reduced motion are supported. The 3D canvases have text alternatives in their side panels, but full screen-reader parity isn't there yet.
- **E2E tests**: Playwright assertions cover navigation, search, layer toggles, mute, hide-UI, touch controls, the per-viewport layout audit and in-browser ASCENT orbit insertion. Data pages depend on live providers, so content assertions stay loose.
