// Capture screenshots of the running app (default http://localhost:3000) with system Chrome.
// Usage: BASE_URL=http://localhost:3000 node scripts/screenshots.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const shots = [
  { name: "home", path: "/", wait: 9000 },
  { name: "sky", path: "/sky", wait: 4000, act: async (p) => { await p.selectOption("select[aria-label=\"Preset location\"]", { label: "Los Angeles, CA" }).catch(() => {}); await p.waitForTimeout(3000); } },
  { name: "orbit", path: "/orbit", wait: 12000 },
  { name: "launches", path: "/launches", wait: 5000 },
  { name: "ascent", path: "/ascent", wait: 6000, act: async (p) => { await p.click("button:has-text(\"Assist (P)\")"); await p.click("button:text-is(\"Launch\")"); await p.waitForTimeout(13000); for (let i = 0; i < 3; i++) await p.keyboard.press("Period"); await p.waitForTimeout(25000); } },
  { name: "ascent-map", path: "/ascent", wait: 6000, act: async (p) => { await p.click("button:has-text(\"Assist (P)\")"); await p.click("button:text-is(\"Launch\")"); await p.waitForTimeout(12000); for (let i = 0; i < 3; i++) await p.keyboard.press("Period"); await p.waitForTimeout(40000); await p.keyboard.press("KeyM"); await p.waitForTimeout(1000); } },
  { name: "earth", path: "/earth", wait: 12000 },
  { name: "flights", path: "/flights", wait: 10000 },
  { name: "status", path: "/status", wait: 3000 },
];
const errors = {};
for (const s of shots) {
  const page = await ctx.newPage();
  errors[s.name] = [];
  page.on("pageerror", (e) => errors[s.name].push(String(e.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors[s.name].push(m.text().slice(0, 200)); });
  await page.goto(BASE + s.path, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(s.wait);
  if (s.act) await s.act(page);
  await page.screenshot({ path: `${OUT}${s.name}.png` });
  console.log("saved", s.name, errors[s.name].length ? `errors: ${JSON.stringify(errors[s.name])}` : "");
  await page.close();
}
await browser.close();
