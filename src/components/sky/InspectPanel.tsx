"use client";
import * as A from "astronomy-engine";
import { bodyState, riseSet, applyHor, eqjToHorMatrix, constellationAt, type ObserverLoc } from "@/lib/astro/sky";
import { bvToTemperatureK, starLabel } from "@/lib/astro/catalog";
import { formatRa, formatDec } from "@/lib/astro/coords";
import type { SkySelection } from "./SkyCanvas";
import { bodyToTarget } from "@/providers/planetary-imagery/targets";

const Row = ({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) => (
  <div className="flex justify-between gap-3 border-b hairline py-1 text-[12px]" title={hint}><span className="text-starlight/50">{k}</span><span className="mono text-right">{v}</span></div>
);
const t = (d: Date | null, tz?: string) => (d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: tz }) + " " + d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: tz }) : "does not occur");

function starRiseSet(ra: number, dec: number, date: Date, obs: ObserverLoc) {
  // Define a fixed star for Astronomy Engine. Distance is irrelevant for rise/set; 1000 ly is a placeholder for the API only.
  A.DefineStar(A.Body.Star1, ra / 15, dec, 1000);
  const o = new A.Observer(obs.lat, obs.lon, obs.heightM);
  const start = new Date(date.getTime() - 12 * 3600_000);
  const rise = A.SearchRiseSet(A.Body.Star1, o, +1, start, 2);
  const set = A.SearchRiseSet(A.Body.Star1, o, -1, rise?.date ?? start, 2);
  return { rise: rise?.date ?? null, set: set?.date ?? null };
}

/** Inspection panel. Only properties present in the catalog or computed by the ephemeris are shown. */
export function InspectPanel({ sel, date, obs, onClose, onImagery }: { sel: SkySelection; date: Date; obs: ObserverLoc; onClose: () => void; onImagery?: (target: string) => void }) {
  if (!sel) return null;
  let title = "", sub = "", rows: React.ReactNode = null, source = "";
  if (sel.kind === "star") {
    const s = sel.star;
    const h = applyHor(eqjToHorMatrix(date, obs), s[1], s[2]);
    const rs = starRiseSet(s[1], s[2], date, obs);
    title = starLabel(s);
    sub = [s[6] && `${s[6]} ${s[8]}`, s[7] && `${s[7]} ${s[8]}`].filter(Boolean).join(" · ") || "Star";
    const temp = bvToTemperatureK(s[4]);
    rows = (<>
      <Row k="Catalog" v={`HIP ${s[0]}`} />
      <Row k="Constellation" v={constellationAt(s[1], s[2])} />
      <Row k="Visual magnitude" v={s[3].toFixed(2)} />
      <Row k="B−V colour index" v={s[4] != null ? s[4].toFixed(3) : "n/a"} />
      {temp && <Row k="Temperature (est.)" v={`~${temp.toLocaleString()} K`} hint="Estimated from B−V (Ballesteros 2012). Not a measured value." />}
      <Row k="RA (J2000)" v={formatRa(s[1])} />
      <Row k="Dec (J2000)" v={formatDec(s[2])} />
      <Row k="Altitude" v={`${h.alt.toFixed(2)}°`} hint="Geometric, without refraction" />
      <Row k="Azimuth" v={`${h.az.toFixed(2)}°`} />
      <Row k="Rises" v={t(rs.rise)} />
      <Row k="Sets" v={t(rs.set)} />
    </>);
    source = "Hipparcos/XHIP via d3-celestial; positions by Astronomy Engine";
  } else if (sel.kind === "body") {
    const b = bodyState(sel.name, date, obs);
    const rs = riseSet(sel.name, date, obs);
    title = b.name; sub = sel.name === "Sun" ? "Star (G2V)" : sel.name === "Moon" ? "Natural satellite" : "Planet";
    rows = (<>
      <Row k="Constellation" v={b.constellation} />
      <Row k="Altitude" v={`${b.altDeg.toFixed(2)}°`} hint="Includes standard refraction" />
      <Row k="Azimuth" v={`${b.azDeg.toFixed(2)}°`} />
      <Row k="RA (of date)" v={formatRa(b.raHours * 15)} />
      <Row k="Dec (of date)" v={formatDec(b.decDeg)} />
      <Row k="Distance" v={sel.name === "Moon" ? `${Math.round(b.distanceAu * A.KM_PER_AU).toLocaleString()} km` : `${b.distanceAu.toFixed(4)} AU`} />
      {b.magnitude != null && <Row k="Apparent magnitude" v={b.magnitude.toFixed(2)} />}
      {b.phaseFraction != null && sel.name !== "Sun" && <Row k="Illuminated" v={`${(b.phaseFraction * 100).toFixed(1)}%`} />}
      {b.elongationDeg != null && <Row k="Elongation from Sun" v={`${b.elongationDeg.toFixed(1)}°`} />}
      <Row k="Rises" v={t(rs.rise)} />
      <Row k="Transits" v={rs.transit ? `${t(rs.transit)} (${rs.transitAltDeg?.toFixed(1)}°)` : "—"} />
      <Row k="Sets" v={t(rs.set)} />
    </>);
    source = "Astronomy Engine (VSOP87/ELP-based ephemeris), apparent topocentric";
  } else {
    const c = sel.con;
    title = c.name; sub = `Constellation · ${c.id} · genitive ${c.gen}`;
    const h = applyHor(eqjToHorMatrix(date, obs), c.label[0], c.label[1]);
    rows = (<>
      <Row k="IAU abbreviation" v={c.id} />
      <Row k="Label position alt/az" v={`${h.alt.toFixed(1)}° / ${h.az.toFixed(1)}°`} />
      <Row k="Line segments" v={c.lines.reduce((n, s) => n + s.length - 1, 0)} />
    </>);
    source = "IAU constellation figures via d3-celestial (BSD-3-Clause)";
  }
  return (
    <aside className="glass fade-in w-[300px] p-4" aria-label={`Details for ${title}`}>
      <div className="flex items-start justify-between">
        <div><h2 className="text-[16px] font-medium">{title}</h2><p className="text-[11px] text-violet">{sub}</p></div>
        <button onClick={onClose} aria-label="Close details" className="text-starlight/50 hover:text-starlight">✕</button>
      </div>
      <div className="mt-3">{rows}</div>
      {sel.kind === "body" && onImagery && bodyToTarget(sel.name) && (
        <button className="btn btn-primary mt-3 w-full" onClick={() => onImagery(bodyToTarget(sel.name)!)} data-testid="open-imagery">
          Surface & Mission Imagery{sel.name === "Mars" ? " · rover photos" : ""}
        </button>
      )}
      <p className="mt-2 text-[10px] text-starlight/40">Source: {source}. Times shown in your browser time zone.</p>
    </aside>
  );
}
