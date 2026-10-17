/// <reference lib="webworker" />
import { json2satrec, propagate, gstime, eciToEcf, type SatRec } from "@/lib/orbit/satellite";

const R = 6371.0088;
let recs: (SatRec | null)[] = [];

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: "load"; omms: unknown[] } | { type: "tick"; t: number; id: number };
  if (msg.type === "load") {
    recs = msg.omms.map((o) => { try { return json2satrec(o as Parameters<typeof json2satrec>[0]); } catch { return null; } });
    (self as unknown as Worker).postMessage({ type: "loaded", count: recs.length, failed: recs.filter((r) => !r).length });
    return;
  }
  if (msg.type === "tick") {
    const date = new Date(msg.t);
    const gmst = gstime(date);
    const pos = new Float32Array(recs.length * 3);
    const alt = new Float32Array(recs.length);
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      const pv = r ? propagate(r, date) : null;
      if (!pv || !pv.position || typeof pv.position === "boolean" || !Number.isFinite(pv.position.x)) { alt[i] = NaN; pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0; continue; }
      const f = eciToEcf(pv.position, gmst);
      // ECEF → scene (x, z, −y), Earth radii
      pos[i * 3] = f.x / R; pos[i * 3 + 1] = f.z / R; pos[i * 3 + 2] = -f.y / R;
      alt[i] = Math.hypot(f.x, f.y, f.z) - R;
    }
    (self as unknown as Worker).postMessage({ type: "positions", id: msg.id, t: msg.t, pos, alt }, [pos.buffer, alt.buffer]);
  }
};
