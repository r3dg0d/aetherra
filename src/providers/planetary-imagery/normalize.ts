import { allowedImageUrl, type ImageryItem, type ImageryKind } from "./types";
import { ROVERS, cameraLabel } from "./targets";

/* ---------- Mars raw images ---------- */

/** Perseverance item from mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json */
export interface M20Raw {
  imageid: string; sol: number; title?: string; caption?: string; credit?: string; link?: string;
  date_taken_utc?: string; date_received?: string; sample_type?: string;
  camera?: { instrument?: string; filter_name?: string };
  image_files?: { small?: string; medium?: string; large?: string; full_res?: string };
}
/** Curiosity item from mars.nasa.gov/api/v1/raw_image_items/?condition_1=msl:mission */
export interface MslRaw {
  id: number; imageid: string; sol: number; instrument?: string; title?: string; description?: string; image_credit?: string;
  url?: string; https_url?: string; date_taken?: string; link?: string; is_thumbnail?: boolean; extended?: { sample_type?: string | null };
}

const utc = (s: string | null | undefined) => {
  if (!s) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`; // the Perseverance feed omits the zone but the field is UTC
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const RAW_NOTE = "Raw, uncalibrated image as downlinked (no colour/radiometric correction).";

export function normalizeM20(r: M20Raw): ImageryItem | null {
  if (r.sample_type?.toLowerCase() === "thumbnail") return null;
  const f = r.image_files ?? {};
  const thumb = allowedImageUrl(f.small ?? f.medium);
  const large = allowedImageUrl(f.large ?? f.medium ?? f.small);
  if (!r.imageid || !thumb || !large || typeof r.sol !== "number") return null;
  const instrument = r.camera?.instrument ?? null;
  return {
    id: `m20:${r.imageid}`, source: "mars-raw-m20", target: "mars",
    title: (r.title ?? `Perseverance sol ${r.sol}`).trim(), mission: ROVERS.perseverance.mission,
    instrument: cameraLabel("perseverance", instrument), date: utc(r.date_taken_utc), dateKind: "acquired", sol: r.sol,
    thumb, large, full: allowedImageUrl(f.full_res),
    pageUrl: r.link?.startsWith("https://mars.nasa.gov/") ? r.link : `https://mars.nasa.gov/mars2020/multimedia/raw-images/${encodeURIComponent(r.imageid)}`,
    credit: r.credit?.trim() || "NASA/JPL-Caltech", description: r.caption?.trim() || null,
    kind: "raw", rightsNote: RAW_NOTE, dataClass: "DELAYED",
  };
}

export function normalizeMsl(r: MslRaw): ImageryItem | null {
  if (r.is_thumbnail || r.extended?.sample_type === "thumbnail") return null;
  const src = allowedImageUrl(r.https_url ?? r.url);
  if (!r.imageid || !src || typeof r.sol !== "number") return null;
  return {
    id: `msl:${r.imageid}`, source: "mars-raw-msl", target: "mars",
    title: (r.title ?? `Curiosity sol ${r.sol}`).trim(), mission: ROVERS.curiosity.mission,
    instrument: cameraLabel("curiosity", r.instrument ?? null), date: utc(r.date_taken), dateKind: "acquired", sol: r.sol,
    thumb: src, large: src, full: src,
    pageUrl: `https://mars.nasa.gov/raw_images/${encodeURIComponent(String(r.id))}/`,
    credit: r.image_credit?.trim() || "NASA/JPL-Caltech", description: r.description?.trim() || null,
    kind: "raw", rightsNote: RAW_NOTE, dataClass: "DELAYED",
  };
}

/* ---------- NASA Image and Video Library ---------- */

export interface IvlItem {
  href?: string;
  data: { nasa_id: string; title?: string; date_created?: string; center?: string; description?: string; description_508?: string; keywords?: string[]; photographer?: string; secondary_creator?: string; media_type?: string }[];
  links?: { href: string; rel: string; render?: string; size?: number; width?: number; height?: number }[];
}

const ILLUSTRATION = /\b(artist'?s?|illustration|concept|rendering|rendered|animation|simulated|graphic|diagram|infographic)\b/i;
const PROCESSED = /\b(citizen scientist|enhanced image by|processed by|image processing by)\b/i;
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function classifyIvl(title: string, keywords: string[], description: string): ImageryKind {
  if (ILLUSTRATION.test(title) || keywords.some((k) => ILLUSTRATION.test(k))) return "illustration";
  if (PROCESSED.test(description)) return "processed";
  return "photo";
}

/** Pull an explicit credit line out of the description when present (e.g. "Image credit: NASA/JPL-Caltech/SwRI"). */
export function creditFromDescription(desc: string): string | null {
  const m = desc.match(/(?:image\s+)?credits?\s*:\s*([^\n]{3,140}?)(?:\s{2,}|\s-\s|$|\.\s+[A-Z(])/i);
  return m ? m[1].trim().replace(/[.;,]$/, "") : null;
}

export function normalizeIvl(it: IvlItem, target: string, mission: string): ImageryItem | null {
  const d = it.data?.[0];
  if (!d?.nasa_id || (d.media_type && d.media_type !== "image")) return null;
  const preview = it.links?.find((l) => l.rel === "preview");
  const canonical = it.links?.find((l) => l.rel === "canonical");
  const thumb = allowedImageUrl(preview?.href);
  if (!thumb) return null;
  const canonicalOk = canonical && /\.(jpe?g|png|gif)$/i.test(canonical.href) && (canonical.size ?? 0) < 8_000_000 ? allowedImageUrl(canonical.href) : null;
  const title = strip(d.title ?? d.nasa_id);
  const description = d.description ? strip(d.description).slice(0, 1800) : null;
  const kw = d.keywords ?? [];
  const kind = classifyIvl(title, kw, description ?? "");
  const credit = d.secondary_creator?.trim() || d.photographer?.trim() || (description && creditFromDescription(description)) || `NASA${d.center ? `/${d.center}` : ""}`;
  const thirdParty = /\bCC[- ]BY\b/i.test(description ?? "");
  return {
    id: `ivl:${d.nasa_id}`, source: "nasa-ivl", target, title, mission,
    instrument: null, date: d.date_created ? new Date(d.date_created).toISOString() : null, dateKind: "created", sol: null,
    thumb, large: canonicalOk ?? thumb, full: allowedImageUrl(canonical?.href),
    pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
    credit, description, kind,
    rightsNote: thirdParty
      ? "Includes third-party processing released under CC BY; credit the processor as stated in the description."
      : kind === "illustration" ? "Artwork or rendering, not a photograph." : "NASA media is generally not subject to copyright in the US; check the item page for any third-party rights.",
    dataClass: "HISTORICAL",
  };
}
