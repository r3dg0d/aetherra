import { test, expect } from "@playwright/test";

/** Full in-browser ascent: assist autopilot + time warp until the HUD reports orbit insertion. Slow under SwiftShader. */
test("ASCENT reaches orbit with assist and time warp", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "run once, on desktop");
  test.setTimeout(12 * 60_000);
  await page.addInitScript(() => localStorage.setItem("aetherra-app", JSON.stringify({ state: { quality: "low", muted: true }, version: 2 })));
  await page.goto("/ascent");
  await page.getByRole("button", { name: "Assist (P)" }).click();
  await page.getByRole("button", { name: "Launch", exact: true }).click();
  const achieved = page.getByTestId("orbit-achieved");
  const start = Date.now();
  while (Date.now() - start < 11 * 60_000) {
    if (await achieved.isVisible()) break;
    await page.keyboard.press("Period");
    await page.waitForTimeout(5000);
  }
  await expect(achieved).toBeVisible();
  const log = await page.getByTestId("flight-log").innerText();
  expect(log).toMatch(/ORBIT ACHIEVED at T\+\d+/);
  const peri = await page.getByTestId("ascent-peri").innerText();
  console.log("orbit achieved", { met: await page.getByTestId("ascent-met").innerText(), peri, alt: await page.getByTestId("ascent-alt").innerText(), insertion: log.match(/ORBIT ACHIEVED at T\+[\d.]+ s/)?.[0], realSeconds: Math.round((Date.now() - start) / 1000) });
  await page.keyboard.press("Comma"); await page.keyboard.press("Comma");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/polish/ascent-orbit-desktop.png" });
});
