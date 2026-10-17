// Voice screenshots into screenshots/voice/. Usage: node scripts/screenshots-voice.mjs (BASE_URL defaults to :3000)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots/voice";
mkdirSync(OUT, { recursive: true });
const fake = () => {
  class FakeRecognition {
    lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
    start() { const t = window.__fakeVoiceTranscript ?? "Mars rover photos"; setTimeout(() => { this.onresult?.({ results: [{ 0: { transcript: t, confidence: 0.93 }, isFinal: true, length: 1 }] }); this.onend?.(); }, 30); }
    stop() { this.onend?.(); } abort() {}
  }
  Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true });
  Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true });
};
const unsupported = () => {
  Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
  Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
};
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const shot = async (p, n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(n); };

const d = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await d.addInitScript(fake); await d.goto(`${BASE}/?nointro`); await d.waitForTimeout(1500);
await d.getByTestId("voice-open").click(); await d.waitForTimeout(600); await shot(d, "voice-panel-desktop");
await d.getByTestId("voice-typed-input").fill("When is the next launch?"); await d.getByTestId("voice-typed-run").click(); await d.waitForTimeout(2500); await shot(d, "voice-next-launch-desktop");
await d.getByTestId("voice-close").click(); await d.getByTestId("settings-open").click(); await d.waitForTimeout(500); await shot(d, "voice-settings-desktop");
await d.keyboard.press("Escape");
const d2 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await d2.addInitScript(unsupported); await d2.goto(`${BASE}/?nointro`); await d2.getByTestId("voice-open").click(); await d2.waitForTimeout(600); await shot(d2, "voice-unsupported-desktop");
const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await m.addInitScript(fake); await m.goto(`${BASE}/?nointro`); await m.getByTestId("voice-open").click(); await m.waitForTimeout(600); await shot(m, "voice-panel-mobile");
await m.evaluate(() => { window.__fakeVoiceTranscript = "Show me Jupiter"; }); await m.getByTestId("voice-mic").click(); await m.waitForTimeout(2500); await shot(m, "voice-command-mobile");
await b.close();
