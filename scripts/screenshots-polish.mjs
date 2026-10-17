// Captures polish screenshots (desktop + mobile per key page) into screenshots/polish/.
// Usage: node scripts/screenshots-polish.mjs  (BASE_URL defaults to http://localhost:3000)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots/polish";
mkdirSync(OUT, { recursive: true });
const pages = [["home", "/?nointro", 7000], ["sky", "/sky", 5000], ["earth", "/earth", 12000], ["orbit", "/orbit", 9000], ["flights", "/flights", 12000], ["launches", "/launches", 4000], ["ascent", "/ascent", 7000], ["status", "/status", 4000]];
const devices = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const only = process.argv[2];
for (const [dev, opts] of Object.entries(devices)) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript((q) => { if (!localStorage.getItem("aetherra-app")) localStorage.setItem("aetherra-app", JSON.stringify({ state: { quality: q }, version: 2 })); }, dev === "desktop" ? "high" : "medium");
  const p = await ctx.newPage();
  for (const [name, path, wait] of pages) {
    if (only && only !== name) continue;
    await p.goto(BASE + path); await p.waitForTimeout(wait);
    await p.screenshot({ path: `${OUT}/${name}-${dev}.png` }); console.log(`${name}-${dev}`);
  }
  if (!only) {
    // Extras: settings panel, hide-UI mode, intro logo frame, mobile menu/sheet.
    await p.goto(BASE + "/sky"); await p.waitForTimeout(4000);
    if (dev === "desktop") {
      await p.getByTestId("settings-open").click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/settings-desktop.png` });
      await p.keyboard.press("Escape"); await p.locator("body").press("h"); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/hide-ui-sky-desktop.png` });
    } else {
      await p.getByTestId("sky-sheet").locator(".sheet-toggle").click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/sky-sheet-mobile.png` });
      await p.getByTestId("menu-toggle").click(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/menu-mobile.png` });
    }
    const c2 = await b.newContext(opts); const p2 = await c2.newPage();
    await p2.goto(BASE + "/"); await p2.waitForTimeout(1800); await p2.screenshot({ path: `${OUT}/intro-${dev}.png` });
    await p2.waitForTimeout(4500); await p2.screenshot({ path: `${OUT}/intro-flight-${dev}.png` }); await c2.close();
  }
  await ctx.close();
}
await b.close();
