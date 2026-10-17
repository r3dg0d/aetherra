import { test, expect, type Page } from "@playwright/test";
import { collectErrors, horizontalOverflow, smallTargets } from "./helpers";

const FAKE_RECOGNITION = () => {
  class FakeRecognition {
    lang = ""; interimResults = false; continuous = false; maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
    start() {
      (window as unknown as { __fakeRecognitionStarts: number }).__fakeRecognitionStarts = ((window as unknown as { __fakeRecognitionStarts?: number }).__fakeRecognitionStarts ?? 0) + 1;
      const transcript = (window as unknown as { __fakeVoiceTranscript?: string }).__fakeVoiceTranscript ?? "Show me Jupiter";
      setTimeout(() => {
        this.onresult?.({ results: [{ 0: { transcript, confidence: 0.93 }, isFinal: true, length: 1 }] });
        this.onend?.();
      }, 30);
    }
    stop() { this.onend?.(); }
    abort() {}
  }
  Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true });
  Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true });
};

async function withFake(page: Page) { await page.addInitScript(FAKE_RECOGNITION); }

test("voice panel opens from nav; typed fallback runs a command that navigates", async ({ page }) => {
  const errors = collectErrors(page);
  await withFake(page);
  await page.goto("/?nointro");
  // No recognition is created until the user taps: nothing started yet
  expect(await page.evaluate(() => (window as unknown as { __fakeRecognitionStarts?: number }).__fakeRecognitionStarts ?? 0)).toBe(0);
  await page.getByTestId("voice-open").click();
  const panel = page.getByTestId("voice-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Push-to-talk only/)).toBeVisible();
  await expect(panel.getByTestId("voice-mic")).toBeEnabled();
  await panel.getByTestId("voice-typed-input").fill("Show me Jupiter");
  await panel.getByTestId("voice-typed-run").click();
  await expect(panel.getByTestId("voice-intent")).toContainText("Jupiter");
  await expect(panel.getByTestId("voice-confidence")).toContainText("typed");
  await expect(page).toHaveURL(/\/sky\?body=Jupiter/);
  expect(errors).toEqual([]);
});

test("mocked speech recognition runs 'Mars rover photos' and opens the gallery", async ({ page }) => {
  await withFake(page);
  await page.goto("/sky");
  await page.evaluate(() => { (window as unknown as { __fakeVoiceTranscript?: string }).__fakeVoiceTranscript = "Mars rover photos"; });
  await page.getByTestId("voice-open").click();
  await page.getByTestId("voice-mic").click();
  const panel = page.getByTestId("voice-panel");
  await expect(panel.getByTestId("voice-transcript")).toContainText("Mars rover photos");
  await expect(panel.getByTestId("voice-intent")).toContainText("Mars rover");
  await expect(page.getByTestId("imagery-gallery")).toBeVisible({ timeout: 20000 });
});

test("voice next-launch answer comes from the launches API", async ({ page }) => {
  await withFake(page);
  await page.goto("/?nointro");
  await page.getByTestId("voice-open").click();
  const panel = page.getByTestId("voice-panel");
  await panel.getByTestId("voice-typed-input").fill("When is the next launch?");
  await panel.getByTestId("voice-typed-run").click();
  await expect(panel.getByTestId("voice-reply")).toContainText(/Next launch:|unavailable/i, { timeout: 30000 });
  await expect(panel.getByTestId("voice-action")).toContainText(/Launch Library 2|unavailable/i);
});

test("unsupported browser state shows typed fallback with an honest notice", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
  });
  await page.goto("/?nointro");
  await page.getByTestId("voice-open").click();
  const panel = page.getByTestId("voice-panel");
  await expect(panel.getByTestId("voice-unsupported")).toBeVisible();
  await expect(panel.getByTestId("voice-mic")).toBeDisabled();
  await panel.getByTestId("voice-typed-input").fill("Pause time");
  await panel.getByTestId("voice-typed-run").click();
  await expect(panel.getByTestId("voice-reply")).toContainText(/paused/i);
});

test("unknown command gives spoken-text fallback with suggestions", async ({ page }) => {
  await withFake(page);
  await page.goto("/?nointro");
  await page.getByTestId("voice-open").click();
  const panel = page.getByTestId("voice-panel");
  await panel.getByTestId("voice-typed-input").fill("do a barrel roll please");
  await panel.getByTestId("voice-typed-run").click();
  await expect(panel.getByTestId("voice-intent")).toContainText("No matching command");
  await expect(panel.getByTestId("voice-action")).toContainText("No action taken");
  await expect(panel.getByTestId("voice-suggestion").first()).toBeVisible();
});

test("voice panel layout on touch: no overflow, 44px targets", async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, "touch-only check");
  await withFake(page);
  await page.goto("/?nointro");
  await page.getByTestId("voice-open").click();
  await expect(page.getByTestId("voice-panel")).toBeVisible();
  expect((await horizontalOverflow(page)).canScroll).toBe(false);
  expect(await smallTargets(page)).toEqual([]);
});

test("search palette mic opens the voice panel", async ({ page }) => {
  await withFake(page);
  await page.goto("/?nointro");
  await page.getByTestId("search-open").click();
  await page.getByTestId("search-voice").click();
  await expect(page.getByTestId("voice-panel")).toBeVisible();
});
