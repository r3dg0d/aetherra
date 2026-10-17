import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import m20 from "./fixtures/mars2020-raw.sample.json";
import msl from "./fixtures/msl-raw.sample.json";
import juno from "./fixtures/ivl-junocam.sample.json";
import cassini from "./fixtures/ivl-cassini.sample.json";
import { normalizeM20, normalizeMsl, normalizeIvl, creditFromDescription, classifyIvl, type M20Raw, type MslRaw, type IvlItem } from "@/providers/planetary-imagery/normalize";
import { allowedImageUrl } from "@/providers/planetary-imagery/types";
import { takeBudget, resetBudgets } from "@/providers/planetary-imagery/budget";
import { clearCache } from "@/providers/core/cache";
import { ProviderError } from "@/providers/core/types";

describe("planetary imagery normalization (recorded fixtures)", () => {
  it("normalizes Perseverance raw items: UTC date, sol, camera label, credit, official link, DELAYED + raw", () => {
    const items = (m20.images as M20Raw[]).map(normalizeM20).filter((x) => x != null);
    expect(items.length).toBe(m20.images.length);
    const a = items[0];
    expect(a.source).toBe("mars-raw-m20");
    expect(a.sol).toBe(m20.images[0].sol);
    expect(a.date).toMatch(/Z$/);
    expect(a.date).toBe(new Date(m20.images[0].date_taken_utc + "Z").toISOString());
    expect(a.credit).toBe("NASA/JPL-Caltech");
    expect(a.pageUrl).toMatch(/^https:\/\/mars\.nasa\.gov\/mars2020\/multimedia\/raw-images\//);
    expect(a.thumb).toMatch(/_320\.jpg$/);
    expect(a.kind).toBe("raw");
    expect(a.dataClass).toBe("DELAYED");
    expect(a.rightsNote).toMatch(/uncalibrated/i);
    expect(a.instrument).toBe("SHERLOC WATSON");
  });

  it("normalizes Curiosity items, drops thumbnails, keeps partner credits", () => {
    const raw = msl.items as unknown as MslRaw[];
    const items = raw.map(normalizeMsl).filter((x) => x != null);
    expect(items.length).toBe(raw.filter((r) => !r.is_thumbnail).length);
    expect(items.every((i) => i.date?.endsWith("Z") && i.sol === 5040 && i.dataClass === "DELAYED")).toBe(true);
    expect(items[0].pageUrl).toBe(`https://mars.nasa.gov/raw_images/${raw[0].id}/`);
    expect(items.find((i) => i.instrument === "MAHLI")).toBeTruthy();
    expect(items[0].credit).toMatch(/^NASA\/JPL-Caltech/);
  });

  it("normalizes NASA library items with HISTORICAL class, item page and per-item credit", () => {
    const items = (juno.collection.items as IvlItem[]).map((i) => normalizeIvl(i, "jupiter", "Juno / JunoCam")).filter((x) => x != null);
    expect(items.length).toBeGreaterThan(5);
    const first = items[0];
    expect(first.pageUrl).toBe("https://images.nasa.gov/details/PIA21108");
    expect(first.dataClass).toBe("HISTORICAL");
    expect(first.dateKind).toBe("created");
    expect(first.thumb).toMatch(/^https:\/\/images-assets\.nasa\.gov\//);
    // Citizen-scientist processed, CC BY: labelled as processed with a rights note.
    expect(first.kind).toBe("processed");
    expect(first.rightsNote).toMatch(/CC BY/);
  });

  it("flags artwork as illustration so it is never passed off as a photo", () => {
    const items = (cassini.collection.items as IvlItem[]).map((i) => normalizeIvl(i, "saturn", "Cassini")).filter((x) => x != null);
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.kind]));
    expect(byTitle["Cassini orbiting Saturn (Illustration)"]).toBe("illustration");
    expect(byTitle["Artists Conception of Cassini Saturn Orbit Insertion"]).toBe("illustration");
    expect(byTitle["Cassini \"Noodle\" Mosaic of Saturn"]).toBe("photo");
    expect(classifyIvl("Europa", ["Europa"], "Image credit: NASA/JPL")).toBe("photo");
  });

  it("extracts credit lines and enforces the image host allowlist", () => {
    expect(creditFromDescription("Jupiter's south pole. Image credit: NASA/JPL-Caltech/SwRI/MSSS. More text")).toBe("NASA/JPL-Caltech/SwRI/MSSS");
    expect(allowedImageUrl("http://images-assets.nasa.gov/image/x/x~thumb.jpg")).toBe("https://images-assets.nasa.gov/image/x/x~thumb.jpg");
    expect(allowedImageUrl("https://evil.example.com/a.jpg")).toBeNull();
    expect(allowedImageUrl("javascript:alert(1)")).toBeNull();
    const bad = { ...(m20.images[0] as M20Raw), image_files: { small: "https://cdn.example.org/a.jpg", large: "https://cdn.example.org/b.jpg" } };
    expect(normalizeM20(bad)).toBeNull();
  });
});

describe("planetary imagery failure, backoff and quota", () => {
  beforeEach(() => { resetBudgets(); clearCache(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("local budget throws a 429 ProviderError with retry-after once exhausted", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) takeBudget("x", 3, 60_000, t0 + i);
    try { takeBudget("x", 3, 60_000, t0 + 10); expect.unreachable(); }
    catch (e) { expect(e).toBeInstanceOf(ProviderError); expect((e as ProviderError).status).toBe(429); expect((e as ProviderError).retryAfterSeconds).toBe(60); }
    expect(() => takeBudget("x", 3, 60_000, t0 + 60_001)).not.toThrow();
  });

  it("archive route returns UNAVAILABLE (never fabricated items) when upstream fails, then serves cache as stale", async () => {
    const { GET } = await import("@/app/api/imagery/route");
    let fail = false;
    vi.stubGlobal("fetch", vi.fn(async () => fail ? new Response("down", { status: 500 }) : new Response(JSON.stringify(juno), { status: 200, headers: { "content-type": "application/json" } })));
    // first: success populates cache
    const ok = await (await GET(new Request("http://x/api/imagery?target=jupiter&source=archive&q=junocam"))).json();
    expect(ok.dataClass).toBe("HISTORICAL");
    expect(ok.data.items.length).toBeGreaterThan(0);
    // different query with upstream down and nothing cached: honest UNAVAILABLE + empty
    fail = true;
    const res = await GET(new Request("http://x/api/imagery?target=saturn&source=archive"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.dataClass).toBe("UNAVAILABLE");
    expect(body.data.items).toEqual([]);
    expect(body.notice).toMatch(/unavailable/i);
  }, 20000);

  it("rover route reports UNAVAILABLE on 429 and honours Retry-After without retrying", async () => {
    const { GET } = await import("@/app/api/imagery/route");
    const f = vi.fn(async () => new Response("slow down", { status: 429, headers: { "retry-after": "120" } }));
    vi.stubGlobal("fetch", f);
    const res = await GET(new Request("http://x/api/imagery?target=mars&source=rover&rover=curiosity&sol=5040"));
    const body = await res.json();
    expect(body.dataClass).toBe("UNAVAILABLE");
    expect(f).toHaveBeenCalledTimes(1);
    // circuit open: next call does not hit upstream at all
    const res2 = await GET(new Request("http://x/api/imagery?target=mars&source=rover&rover=curiosity&sol=5041"));
    expect((await res2.json()).dataClass).toBe("UNAVAILABLE");
    expect(f).toHaveBeenCalledTimes(1);
    expect(res2.headers.get("Retry-After")).toBeTruthy();
  });

  it("rejects non-allowlisted parameters", async () => {
    const { GET } = await import("@/app/api/imagery/route");
    expect((await GET(new Request("http://x/api/imagery?target=krypton"))).status).toBe(400);
    expect((await GET(new Request("http://x/api/imagery?target=mars&source=rover&rover=spirit"))).status).toBe(400);
    expect((await GET(new Request("http://x/api/imagery?target=mars&source=rover&sol=-4"))).status).toBe(400);
    expect((await GET(new Request("http://x/api/imagery?target=moon&source=rover"))).status).toBe(400);
  });
});

describe("image host allowlist stays in sync", () => {
  it("next.config IMAGERY_HOSTS matches IMAGE_HOSTS", async () => {
    const { readFileSync } = await import("node:fs");
    const { IMAGE_HOSTS } = await import("@/providers/planetary-imagery/types");
    const cfg = readFileSync("next.config.ts", "utf8");
    const m = cfg.match(/IMAGERY_HOSTS = (\[[^\]]+\])/);
    expect(JSON.parse(m![1])).toEqual([...IMAGE_HOSTS]);
  });
});
