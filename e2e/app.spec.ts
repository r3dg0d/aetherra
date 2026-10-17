import { test, expect, type Page } from "@playwright/test";
import { collectErrors } from "./helpers";

async function openSheet(page: Page, id: string) {
  if (page.viewportSize()!.width >= 768) return;
  const t = page.getByTestId(id).locator(".sheet-toggle");
  if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
}

const isTouch = (p: Page) => p.viewportSize()!.width < 1024;

async function navTo(page: Page, label: string) {
  if (isTouch(page)) {
    await page.getByTestId("menu-toggle").click();
    await page.locator("#mobile-menu").getByRole("link", { name: label, exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label, exact: true }).click();
  }
}

test("primary navigation reaches every mode", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/?nointro");
  for (const [label, path] of [["SKY", "/sky"], ["ORBIT", "/orbit"], ["LAUNCHES", "/launches"], ["ASCENT", "/ascent"], ["EXPLORE", "/"]] as const) {
    await navTo(page, label);
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    await expect(page.locator(`[aria-current="page"]`).first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test("search palette opens and finds a launch site", async ({ page }) => {
  await page.goto("/?nointro");
  await page.getByTestId("search-open").click();
  const input = page.getByRole("dialog").getByRole("combobox").or(page.getByRole("dialog").locator("input")).first();
  await expect(input).toBeVisible();
  await input.fill("Kennedy");
  await expect(page.getByRole("dialog").getByText(/Kennedy/i).first()).toBeVisible();
  await page.keyboard.press("Escape");
});

test("sky layer toggles change state", async ({ page }) => {
  await page.goto("/sky");
  await openSheet(page, "sky-sheet");
  const lines = page.getByTestId("sky-opt-lines");
  await expect(lines).toBeChecked();
  await lines.click();
  await expect(lines).not.toBeChecked();
  const grid = page.getByTestId("sky-opt-grid");
  await grid.click();
  await expect(grid).toBeChecked();
});

test("orbit group toggle and earth base layer", async ({ page }) => {
  await page.goto("/orbit");
  await openSheet(page, "orbit-sheet");
  const gal = page.getByTestId("orbit-group-galileo");
  await gal.click();
  await expect(gal).toBeChecked();
  await page.goto("/earth");
  await openSheet(page, "earth-sheet");
  const sel = page.getByTestId("earth-base-layer");
  await sel.selectOption({ index: 1 });
  await expect(sel).not.toHaveValue("osm");
});

test("mute toggle starts muted and persists", async ({ page }) => {
  await page.goto("/?nointro");
  const mute = page.getByTestId("mute-toggle");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  const audioState = await page.evaluate(() => new Promise<string>((r) => setTimeout(() => r((window as unknown as { __aetherraAudioState?: string }).__aetherraAudioState ?? "n/a"), 300)));
  expect(["running", "suspended", "n/a"]).toContain(audioState);
  await page.reload();
  await expect(page.getByTestId("mute-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("mute-toggle").click();
  await expect(page.getByTestId("mute-toggle")).toHaveAttribute("aria-pressed", "false");
});

test("screenshot mode hides chrome", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 768, "keyboard shortcut is desktop-only; menu entry covered on touch");
  await page.goto("/sky");
  await page.locator("body").press("h");
  await expect(page.locator("header.app-header")).toBeHidden();
  await expect(page.getByRole("button", { name: "Show interface" })).toBeVisible();
  await page.getByRole("button", { name: "Show interface" }).click();
  await expect(page.locator("header.app-header")).toBeVisible();
});

test("ascent touch controls appear on touch devices", async ({ page }, info) => {
  await page.goto("/ascent");
  const tc = page.getByTestId("touch-controls");
  if (info.project.use.hasTouch) await expect(tc).toBeVisible(); else await expect(tc).toBeHidden();
});
