import { describe, it, expect } from "vitest";
import { parseCommand, normalizeUtterance, formatCountdown, intentLabel } from "@/lib/voice/intents";

const cases: [string, string, (i: ReturnType<typeof parseCommand>["intent"]) => void][] = [
  ["Go to the sky", "navigate", (i) => { if (i.kind === "navigate") expect(i.href).toBe("/sky"); }],
  ["open launches", "navigate", (i) => { if (i.kind === "navigate") expect(i.href).toBe("/launches"); }],
  ["take me to ascent", "navigate", (i) => { if (i.kind === "navigate") expect(i.view).toBe("ascent"); }],
  ["home", "navigate", (i) => { if (i.kind === "navigate") expect(i.href).toBe("/"); }],
  ["Show me Jupiter", "find-body", (i) => { if (i.kind === "find-body") expect(i.href).toBe("/sky?body=Jupiter"); }],
  ["where is the Moon?", "find-body", (i) => { if (i.kind === "find-body") expect(i.body).toBe("Moon"); }],
  ["fly to Saturn", "find-body", (i) => { if (i.kind === "find-body") expect(i.body).toBe("Saturn"); }],
  ["Find Orion", "find-constellation", (i) => { if (i.kind === "find-constellation") { expect(i.name).toBe("Orion"); expect(i.href).toBe("/sky?con=Ori"); } }],
  ["show Ursa Major", "find-constellation", (i) => { if (i.kind === "find-constellation") expect(i.id).toBe("UMa"); }],
  ["Where is the ISS?", "find-satellite", (i) => { if (i.kind === "find-satellite") expect(i.href).toBe("/orbit?sat=25544"); }],
  ["track Tiangong", "find-satellite", (i) => { if (i.kind === "find-satellite") expect(i.norad).toBe(48274); }],
  ["Mars rover photos", "imagery", (i) => { if (i.kind === "imagery") expect(i.href).toBe("/sky?gallery=mars&source=rover"); }],
  ["show Curiosity rover pictures", "imagery", (i) => { if (i.kind === "imagery") expect(i.href).toContain("rover=curiosity"); }],
  ["Moon photos", "imagery", (i) => { if (i.kind === "imagery") expect(i.href).toBe("/sky?gallery=moon"); }],
  ["Jupiter Juno images", "imagery", (i) => { if (i.kind === "imagery") expect(i.href).toContain("q=junocam"); }],
  ["Titan images", "imagery", (i) => { if (i.kind === "imagery") expect(i.target).toBe("titan"); }],
  ["When is the next launch?", "next-launch", () => {}],
  ["next launch countdown", "next-launch", () => {}],
  ["Remind me about the next launch", "remind-next", () => {}],
  ["remind me about all launches", "remind-all", () => {}],
  ["Flights near London", "flights-near", (i) => { if (i.kind === "flights-near") expect(i.place).toBe("london"); }],
  ["what's flying over Tokyo?", "flights-near", (i) => { if (i.kind === "flights-near") expect(i.place).toBe("tokyo"); }],
  ["What's visible tonight?", "tonight", () => {}],
  ["what is up in the sky", "tonight", () => {}],
  ["Pause time", "time", (i) => { if (i.kind === "time") expect(i.action).toBe("pause"); }],
  ["resume time", "time", (i) => { if (i.kind === "time") expect(i.action).toBe("play"); }],
  ["go live", "time", (i) => { if (i.kind === "time") expect(i.action).toBe("live"); }],
  ["speed up time", "time", (i) => { if (i.kind === "time") expect(i.action).toBe("faster"); }],
  ["Turn off constellation lines", "layer", (i) => { if (i.kind === "layer") { expect(i.layer).toBe("lines"); expect(i.on).toBe(false); } }],
  ["show labels", "layer", (i) => { if (i.kind === "layer") { expect(i.layer).toBe("labels"); expect(i.on).toBe(true); } }],
  ["help", "help", () => {}],
  ["what can you do", "help", () => {}],
];

describe("AETHERRA Voice intent parser", () => {
  it.each(cases)("%s", (utterance, kind, check) => {
    const p = parseCommand(utterance);
    expect(p.intent.kind).toBe(kind);
    expect(p.confidence).toBeGreaterThan(0.5);
    check(p.intent);
  });

  it("strips wake-word style prefixes and punctuation without wake-word listening", () => {
    expect(normalizeUtterance("Hey AETHERRA, please show me Jupiter!")).toBe("show me jupiter");
    expect(parseCommand("Hey AETHERRA, find Orion.").intent.kind).toBe("find-constellation");
  });

  it("unknown and empty commands fall back with suggestions", () => {
    for (const u of ["", "   ", "flibberty gibbet nonsense", "do a barrel roll"]) {
      const p = parseCommand(u);
      expect(p.intent.kind).toBe("unknown");
      if (p.intent.kind === "unknown") expect(p.intent.suggestions.length).toBeGreaterThan(5);
    }
    expect(parseCommand("flibberty").confidence).toBeLessThan(0.5);
  });

  it("imagery wins over body find, layers win over constellation find", () => {
    expect(parseCommand("Mars photos").intent.kind).toBe("imagery");
    expect(parseCommand("turn on constellations").intent.kind).toBe("layer");
    expect(parseCommand("find Orion").intent.kind).toBe("find-constellation");
  });

  it("generic find becomes a search query reusing universal search", () => {
    const p = parseCommand("find Betelgeuse");
    expect(p.intent.kind).toBe("find-query");
    if (p.intent.kind === "find-query") expect(p.intent.query).toBe("betelgeuse");
    expect(intentLabel(p.intent)).toContain("betelgeuse");
  });

  it("formats countdowns for display and speech", () => {
    expect(formatCountdown(90_000)).toBe("T-0h 01m 30s");
    expect(formatCountdown(90_000, true)).toContain("1 minute");
    expect(formatCountdown(-5_000)).toMatch(/^T\+/);
    expect(formatCountdown(2 * 86400_000 + 3600_000, true)).toContain("2 days");
  });
});
