import type { VideoLink } from "./types";

/** Hosts whose channels are operated by the launch providers/agencies themselves or the official LL2-listed broadcasters. */
const OFFICIAL_HOST_HINTS = ["nasa.gov", "spacex.com", "x.com/spacex", "rocketlabusa.com", "blueorigin.com", "ulalaunch.com", "esa.int", "jaxa.jp", "arianespace.com", "isro.gov.in"];

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = /\/(live|embed|shorts)\/([\w-]{6,})/.exec(u.pathname);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

export interface StreamInfo extends VideoLink {
  embedUrl: string | null;
  official: boolean;
  kind: "livestream" | "recording" | "unknown";
}

/** Livestream metadata handler: classify LL2 vid_urls. Only links LL2 lists are shown; nothing is invented. */
export function describeStreams(links: VideoLink[], launchStatus: string): StreamInfo[] {
  return links.map((l) => {
    const id = youtubeId(l.url);
    const official = OFFICIAL_HOST_HINTS.some((h) => l.url.includes(h)) || /nasa|spacex|rocket lab|ula|esa|jaxa|blue origin|arianespace|isro/i.test(l.publisher ?? "");
    const past = ["Success", "Failure", "Partial Failure"].includes(launchStatus);
    return { ...l, embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}` : null, official, kind: past ? "recording" : l.live || l.type?.toLowerCase().includes("live") ? "livestream" : "unknown" };
  });
}
