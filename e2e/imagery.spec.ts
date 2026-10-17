import { test, expect, type Page } from "@playwright/test";
import { collectErrors, horizontalOverflow, smallTargets } from "./helpers";

async function openFromInspect(page: Page, body: string) {
  await page.goto(`/sky?body=${body}`);
  const open = page.getByTestId("open-imagery");
  if (page.viewportSize()!.width < 768) {
    const t = page.getByTestId("sky-sheet").locator(".sheet-toggle");
    if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
  }
  await open.click();
  await expect(page.getByTestId("imagery-gallery")).toBeVisible();
}

test("Mars gallery opens from the planet panel with raw rover images and full lightbox metadata", async ({ page }) => {
  const errors = collectErrors(page);
  await openFromInspect(page, "Mars");
  const g = page.getByTestId("imagery-gallery");
  await expect(g.getByTestId("imagery-source-rover")).toHaveAttribute("aria-selected", "true");
  await expect(g.getByText(/raw and uncalibrated/i)).toBeVisible();
  // Either real thumbnails or an honest UNAVAILABLE state; never placeholders.
  const thumb = g.getByTestId("imagery-thumb").first();
  await expect(thumb.or(g.getByTestId("imagery-unavailable"))).toBeVisible({ timeout: 45_000 });
  test.skip(!(await thumb.isVisible()), "Upstream rover feed unavailable right now (UNAVAILABLE state shown)");
  await expect(g.getByText("RAW · UNCALIBRATED").first()).toBeVisible();
  await thumb.click();
  const lb = page.getByTestId("lightbox");
  await expect(lb).toBeVisible();
  await expect(lb.getByText(/Acquired \(Earth, UTC\)/)).toBeVisible();
  await expect(lb.getByText("Sol", { exact: true })).toBeVisible();
  await expect(lb.getByText(/NASA\/JPL-Caltech/).first()).toBeVisible();
  await expect(lb.getByRole("link", { name: /Official page/ })).toHaveAttribute("href", /^https:\/\/mars\.nasa\.gov\//);
  const counter = lb.locator("span.mono").filter({ hasText: "/" }).first();
  const before = await counter.innerText();
  await page.keyboard.press("ArrowRight");
  await expect(counter).not.toHaveText(before);
  await page.keyboard.press("Escape");
  await expect(lb).toBeHidden();
  await expect(g).toBeVisible();
  // Curiosity + camera filter
  await g.getByTestId("imagery-rover").selectOption("curiosity");
  await expect(g.getByTestId("imagery-thumb").first().or(g.getByTestId("imagery-empty")).or(g.getByTestId("imagery-unavailable"))).toBeVisible({ timeout: 45_000 });
  await page.keyboard.press("Escape");
  await expect(g).toBeHidden();
  expect(errors).toEqual([]);
});

test("Moon gallery shows NASA library imagery with mission filters", async ({ page }) => {
  const errors = collectErrors(page);
  await openFromInspect(page, "Moon");
  const g = page.getByTestId("imagery-gallery");
  await expect(g.getByTestId("imagery-q-apollo")).toHaveAttribute("aria-pressed", "true");
  const thumb = g.getByTestId("imagery-thumb").first();
  await expect(thumb.or(g.getByTestId("imagery-unavailable"))).toBeVisible({ timeout: 45_000 });
  test.skip(!(await thumb.isVisible()), "NASA library unavailable right now");
  await g.getByTestId("imagery-q-lro").click();
  await expect(g.getByTestId("imagery-q-lro")).toHaveAttribute("aria-pressed", "true");
  await expect(g.getByTestId("imagery-thumb").first()).toBeVisible({ timeout: 45_000 });
  await g.getByTestId("imagery-thumb").first().click();
  const lb = page.getByTestId("lightbox");
  await expect(lb.getByRole("link", { name: /Official page/ })).toHaveAttribute("href", /^https:\/\/images\.nasa\.gov\/details\//);
  await expect(lb.getByText(/Date \(library record, UTC\)/)).toBeVisible();
  await lb.getByTestId("lightbox-close").click();
  expect(errors).toEqual([]);
});

test("search opens the Jupiter Juno gallery", async ({ page }) => {
  await page.goto("/?nointro");
  await page.getByTestId("search-open").click();
  await page.getByRole("dialog").getByRole("combobox").fill("Jupiter Juno");
  await page.getByRole("option").filter({ hasText: /Jupiter: Juno/ }).first().click();
  await expect(page).toHaveURL(/gallery=jupiter/);
  const g = page.getByTestId("imagery-gallery");
  await expect(g).toBeVisible();
  await expect(g.getByTestId("imagery-q-junocam")).toHaveAttribute("aria-pressed", "true");
});

test("search 'Mars rover photos' opens the rover tab", async ({ page }) => {
  await page.goto("/sky");
  await page.getByTestId("search-open").click();
  await page.getByRole("dialog").getByRole("combobox").fill("Mars rover photos");
  await page.getByRole("option").filter({ hasText: /Mars rover photos/ }).first().click();
  await expect(page.getByTestId("imagery-gallery")).toBeVisible();
  await expect(page.getByTestId("imagery-source-rover")).toHaveAttribute("aria-selected", "true");
});

test("gallery layout: no horizontal overflow and 44px targets on touch", async ({ page }, info) => {
  await page.goto("/sky?gallery=jupiter&q=junocam");
  const g = page.getByTestId("imagery-gallery");
  await expect(g.getByTestId("imagery-thumb").first().or(g.getByTestId("imagery-unavailable"))).toBeVisible({ timeout: 45_000 });
  await expect(g.getByTestId("imagery-close")).toBeInViewport();
  expect((await horizontalOverflow(page)).canScroll).toBe(false);
  if (info.project.use.hasTouch) expect(await smallTargets(page)).toEqual([]);
});
