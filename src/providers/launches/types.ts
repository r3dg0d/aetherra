export interface VideoLink { url: string; title?: string; publisher?: string; type?: string; live?: boolean }

export interface NormalizedLaunch {
  id: string;
  source: "ll2";
  slug: string | null;
  name: string;
  statusAbbrev: string;
  statusName: string;
  net: string; // ISO UTC
  netPrecision: string | null; // e.g. "Second", "Minute", "Hour", "Day", "Month"
  windowStart: string | null;
  windowEnd: string | null;
  /** Launch service provider (who flies the rocket). */
  operatorName: string | null;
  operatorAbbrev: string | null;
  operatorType: string | null;
  /** Mission customers/agencies that are not the operator. */
  customers: string[];
  rocketName: string | null;
  rocketFamily: string | null;
  missionName: string | null;
  missionType: string | null;
  missionDescription: string | null;
  orbit: string | null;
  padName: string | null;
  padLat: number | null;
  padLon: number | null;
  locationName: string | null;
  locationTz: string | null;
  countryCode: string | null;
  webcastLive: boolean;
  vidUrls: VideoLink[];
  infoUrls: { url: string; title?: string }[];
  imageUrl: string | null;
  imageCredit: string | null;
  patches: { name: string; imageUrl: string }[];
  timeline: { abbrev: string; description?: string; relativeSeconds: number }[];
  probability: number | null;
  failReason: string | null;
  upstreamUpdatedAt: string | null;
}

export type LaunchUpdateKind = "NEW" | "NET_CHANGED" | "SCRUBBED" | "STATUS_CHANGED" | "WINDOW_CHANGED" | "LAUNCHED";

export interface DetectedChange {
  launchId: string;
  kind: LaunchUpdateKind;
  from: string | null;
  to: string | null;
  /** Whether subscribers should be alerted for this change. */
  notify: boolean;
  dedupeKey: string;
}
