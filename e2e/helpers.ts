import type { Page } from "@playwright/test";

export const PAGES = ["/?nointro", "/sky", "/earth", "/orbit", "/flights", "/launches", "/ascent", "/status"] as const;

/** Benign console noise from third-party libraries (not app errors). */
const IGNORE = [/THREE\.Clock/i, /GPU stall due to ReadPixels/i, /WebGL.*performance/i, /Download the React DevTools/i];

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`); });
  return errors;
}

/** Interactive elements smaller than `min` px in either dimension (visible ones only). Inline text links are exempt (WCAG 2.5.8). */
export async function smallTargets(page: Page, min = 44) {
  return page.evaluate((min) => {
    const out: { tag: string; text: string; w: number; h: number }[] = [];
    const els = document.querySelectorAll<HTMLElement>("a[href], button, select, input:not([type=hidden]), [role=button], [role=tab]");
    for (const el of els) {
      if (el.closest(".cesium-viewer, [data-tap-exempt]")) continue;
      if (el.tagName === "A" && el.closest("p, dd, li > span, figcaption") && !el.closest("nav")) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight * 3) continue;
      // Checkbox/radio/range inside a label: the label is the target.
      let w = r.width, h = r.height;
      const label = el.closest("label");
      if (label && (el as HTMLInputElement).type !== undefined && el.tagName === "INPUT") { const lr = label.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      if (w + 0.5 < min || h + 0.5 < min) out.push({ tag: el.tagName.toLowerCase() + (el.getAttribute("type") ? `[${el.getAttribute("type")}]` : ""), text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40), w: Math.round(w), h: Math.round(h) });
    }
    return out;
  }, min);
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const se = document.scrollingElement!;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed" && r.width > 0 && !el.closest(".cesium-viewer, canvas")) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} → ${Math.round(r.right)}`);
      if (offenders.length > 5) break;
    }
    return { scrollWidth: se.scrollWidth, innerWidth, canScroll: se.scrollWidth > innerWidth + 1, offenders };
  });
}

/** Rough rAF frame sampling (SwiftShader software GL: absolute numbers are a floor, not device FPS). */
export async function sampleFrames(page: Page, ms = 3000) {
  return page.evaluate((ms) => new Promise<{ fps: number; p50: number; p95: number; frames: number }>((resolve) => {
    const dts: number[] = []; let last = performance.now(); const start = last;
    const tick = (now: number) => { dts.push(now - last); last = now; if (now - start < ms) requestAnimationFrame(tick); else { const s = [...dts].sort((a, b) => a - b); resolve({ frames: dts.length, fps: Math.round((dts.length * 1000) / (now - start) * 10) / 10, p50: Math.round(s[Math.floor(s.length * 0.5)] * 10) / 10, p95: Math.round(s[Math.floor(s.length * 0.95)] * 10) / 10 }); } };
    requestAnimationFrame(tick);
  }), ms);
}
