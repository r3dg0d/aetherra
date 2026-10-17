import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { PAGES, collectErrors, horizontalOverflow, sampleFrames, smallTargets } from "./helpers";

/** Layout/perf audit of every page on every device project. Results are also written to test-results/audit/. */
for (const path of PAGES) {
  test(`audit ${path}`, async ({ page }, info) => {
    const errors = collectErrors(page);
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(path.includes("earth") || path.includes("flights") ? 7000 : 4500);
    const overflow = await horizontalOverflow(page);
    const touch = !!info.project.use.hasTouch;
    const small = touch ? await smallTargets(page) : [];
    const frames = await sampleFrames(page, 3000);
    const result = { project: info.project.name, path, overflow, smallTargets: small, frames, errors };
    mkdirSync("test-results/audit", { recursive: true });
    writeFileSync(`test-results/audit/${info.project.name}-${path.replace(/[^a-z]/gi, "") || "home"}.json`, JSON.stringify(result, null, 1));
    expect.soft(errors, "console errors").toEqual([]);
    expect.soft(overflow.canScroll, `horizontal scroll: ${overflow.offenders.join(", ")}`).toBe(false);
    if (touch) expect.soft(small, "tap targets under 44px").toEqual([]);
  });
}
