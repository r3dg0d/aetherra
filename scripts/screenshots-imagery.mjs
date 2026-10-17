// Captures imagery gallery screenshots into screenshots/imagery/. Usage: node scripts/screenshots-imagery.mjs (BASE_URL defaults to :3000)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots/imagery";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const settle = async (p) => { await p.getByTestId("imagery-thumb").first().or(p.getByTestId("imagery-unavailable")).or(p.getByTestId("imagery-empty")).waitFor({ timeout: 45000 }); await p.waitForTimeout(3500); };
const shot = async (p, n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(n); };

const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await d.goto(`${BASE}/sky?body=Mars`); await d.waitForTimeout(2500); await shot(d, "mars-inspect-panel-desktop");
await d.getByTestId("open-imagery").click(); await settle(d); await shot(d, "mars-rover-gallery-desktop");
await d.getByTestId("imagery-thumb").first().click(); await d.waitForTimeout(4000); await shot(d, "mars-lightbox-desktop");
await d.keyboard.press("Escape");
await d.getByTestId("imagery-rover").selectOption("curiosity"); await d.getByTestId("imagery-camera").selectOption("NAV_LEFT_B"); await settle(d); await shot(d, "mars-curiosity-navcam-desktop");
await d.getByTestId("imagery-source-archive").click(); await settle(d); await shot(d, "mars-archive-hirise-desktop");
await d.goto(`${BASE}/sky?gallery=moon`); await settle(d); await shot(d, "moon-apollo-desktop");
await d.getByTestId("imagery-q-lro").click(); await settle(d); await shot(d, "moon-lro-desktop");
await d.getByTestId("imagery-thumb").first().click(); await d.waitForTimeout(4000); await shot(d, "moon-lightbox-desktop");
await d.goto(`${BASE}/sky?gallery=jupiter&q=junocam`); await settle(d); await shot(d, "jupiter-junocam-desktop");
await d.goto(`${BASE}/sky?gallery=saturn`); await settle(d); await shot(d, "saturn-cassini-desktop");
await d.goto(`${BASE}/?nointro`); await d.waitForTimeout(1500); await d.getByTestId("search-open").click(); await d.getByRole("dialog").getByRole("combobox").fill("Mars rover photos"); await d.waitForTimeout(800); await shot(d, "search-mars-rover-photos-desktop");

const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await m.goto(`${BASE}/sky?gallery=mars`); await settle(m); await shot(m, "mars-gallery-mobile");
await m.getByTestId("imagery-thumb").first().click(); await m.waitForTimeout(4000); await shot(m, "mars-lightbox-mobile");
await m.goto(`${BASE}/sky?gallery=moon`); await settle(m); await shot(m, "moon-gallery-mobile");
await m.goto(`${BASE}/sky?gallery=jupiter&q=junocam`); await settle(m); await shot(m, "jupiter-gallery-mobile");
await b.close();
