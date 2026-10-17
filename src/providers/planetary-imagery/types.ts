import type { DataClass } from "@/lib/classification";

/** Hosts AETHERRA will display planetary images from. Anything else is dropped during normalization. */
export const IMAGE_HOSTS = ["mars.nasa.gov", "images-assets.nasa.gov"] as const;

export function allowedImageUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.replace(/^http:\/\//, "https://"));
    return url.protocol === "https:" && (IMAGE_HOSTS as readonly string[]).includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export type ImagerySource = "mars-raw-m20" | "mars-raw-msl" | "nasa-ivl";
/** photo = spacecraft/astronaut image; raw = uncalibrated downlink; illustration = artwork/render; processed = third-party or enhanced. */
export type ImageryKind = "raw" | "photo" | "illustration" | "processed";

export interface ImageryItem {
  id: string;
  source: ImagerySource;
  target: string;
  title: string;
  mission: string;
  instrument: string | null;
  /** ISO 8601 UTC. For rover images: acquisition time. For the NASA library: the item's date_created. */
  date: string | null;
  dateKind: "acquired" | "created";
  sol: number | null;
  thumb: string;
  /** Best display size for the lightbox. */
  large: string;
  /** Largest file, when known. */
  full: string | null;
  /** Official page for the item. */
  pageUrl: string;
  credit: string;
  description: string | null;
  kind: ImageryKind;
  rightsNote: string | null;
  dataClass: DataClass;
}

export interface ImageryPage {
  items: ImageryItem[];
  total: number | null;
  /** Rover feeds: the sol that was listed (latest when none was requested). */
  sol?: number | null;
  latestSol?: number | null;
  query?: string;
}
