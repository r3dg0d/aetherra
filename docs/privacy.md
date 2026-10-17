# Privacy

- **No accounts and no tracking.** There is no analytics or third-party tracking script.
- **Anonymous client ID.** The browser generates a random UUID (`clientId`, stored in localStorage with your settings). It is used only to tie notification subscriptions and the in-app inbox to your browser. It is not linked to any identity.
- **Location.** Your location is requested only when you press "Use my location" in the observer picker. It stays in your browser's local storage as your observer and is never sent to the server. Manual coordinates and presets work without geolocation.
- **Search.** Place searches are proxied through the server to Nominatim (rate-limited and cached), so OSM sees our server, not your IP. The query text is sent to Nominatim.
- **Web Push.** If you enable alerts, your browser's push subscription (endpoint and keys) is stored server-side with your client UUID and preferences. Unsubscribe any time in the notification centre ("Unsubscribe from everything"). Subscriptions the push service reports as gone (404/410) are deactivated automatically.
- **Third-party content loaded by your browser:** map/imagery tiles (OSM, NASA GIBS, optionally Cesium ion) and, only if you click them, livestream and webcam links that open on the provider's site. No video is embedded without your action.
- **Server logs.** Next.js default request logging only. Provider fetch errors are logged without user data.
- **Retention.** Delivered notifications and inbox items are kept in the database. Operators can prune `delivery_events` and `inbox`. No personal data beyond what is listed here is stored.
