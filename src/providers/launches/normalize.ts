import { z } from "zod";
import type { NormalizedLaunch } from "./types";
import { parseIsoDuration } from "./timeline";

const named = z.object({ name: z.string().nullish(), abbrev: z.string().nullish() }).passthrough();

/** Minimal validation: records that fail are skipped, never partially written. */
export const Ll2LaunchSchema = z.object({
  id: z.string().min(8),
  name: z.string(),
  slug: z.string().nullish(),
  net: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid net"),
  net_precision: named.nullish(),
  window_start: z.string().nullish(),
  window_end: z.string().nullish(),
  status: z.object({ abbrev: z.string(), name: z.string() }).passthrough(),
  last_updated: z.string().nullish(),
  probability: z.number().nullish(),
  failreason: z.string().nullish(),
  webcast_live: z.boolean().nullish(),
  image: z.object({ image_url: z.string().nullish(), credit: z.string().nullish() }).passthrough().nullish(),
  launch_service_provider: z.object({ name: z.string(), abbrev: z.string().nullish(), type: z.union([z.string(), named]).nullish() }).passthrough().nullish(),
  rocket: z.object({ configuration: z.object({ full_name: z.string().nullish(), name: z.string().nullish(), families: z.array(named).nullish() }).passthrough().nullish() }).passthrough().nullish(),
  mission: z.object({
    name: z.string().nullish(), type: z.string().nullish(), description: z.string().nullish(),
    orbit: named.nullish(), agencies: z.array(named).nullish(),
    vid_urls: z.array(z.any()).nullish(), info_urls: z.array(z.any()).nullish(),
  }).passthrough().nullish(),
  pad: z.object({
    name: z.string().nullish(),
    latitude: z.union([z.string(), z.number()]).nullish(),
    longitude: z.union([z.string(), z.number()]).nullish(),
    country: z.object({ alpha_2_code: z.string().nullish() }).passthrough().nullish(),
    location: z.object({ name: z.string().nullish(), timezone_name: z.string().nullish() }).passthrough().nullish(),
  }).passthrough().nullish(),
  vid_urls: z.array(z.any()).nullish(),
  info_urls: z.array(z.any()).nullish(),
  mission_patches: z.array(z.any()).nullish(),
  timeline: z.array(z.any()).nullish(),
}).passthrough();

export type Ll2Launch = z.infer<typeof Ll2LaunchSchema>;

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const iso = (s?: string | null) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null);

/** Distinguishes the launch operator (launch_service_provider) from mission customers (mission.agencies). */
export function splitOperatorAndCustomers(l: Ll2Launch) {
  const op = l.launch_service_provider;
  const opNames = new Set([op?.name, op?.abbrev].filter(Boolean).map((s) => s!.toLowerCase()));
  const customers = (l.mission?.agencies ?? [])
    .map((a) => a.name ?? a.abbrev ?? "")
    .filter((n) => n && !opNames.has(n.toLowerCase()));
  return { operatorName: op?.name ?? null, operatorAbbrev: op?.abbrev ?? null, operatorType: typeof op?.type === "string" ? op.type : (op?.type?.name ?? null), customers: [...new Set(customers)] };
}

function links(arr: unknown[] | null | undefined) {
  return (arr ?? []).flatMap((v) => {
    const o = v as Record<string, unknown>;
    if (typeof o?.url !== "string") return [];
    const type = o.type as { name?: string } | undefined;
    return [{ url: o.url, title: (o.title as string) ?? undefined, publisher: (o.publisher as string) ?? (o.source as string) ?? undefined, type: type?.name, live: (o.live as boolean) ?? undefined }];
  });
}

export function normalizeLl2(raw: unknown): NormalizedLaunch | null {
  const parsed = Ll2LaunchSchema.safeParse(raw);
  if (!parsed.success) return null;
  const l = parsed.data;
  const { operatorName, operatorAbbrev, operatorType, customers } = splitOperatorAndCustomers(l);
  const vids = [...links(l.vid_urls), ...links(l.mission?.vid_urls)];
  const seen = new Set<string>();
  return {
    id: l.id,
    source: "ll2",
    slug: l.slug ?? null,
    name: l.name,
    statusAbbrev: l.status.abbrev,
    statusName: l.status.name,
    net: new Date(l.net).toISOString(),
    netPrecision: l.net_precision?.name ?? null,
    windowStart: iso(l.window_start),
    windowEnd: iso(l.window_end),
    operatorName, operatorAbbrev, operatorType, customers,
    rocketName: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? null,
    rocketFamily: l.rocket?.configuration?.families?.[0]?.name ?? null,
    missionName: l.mission?.name ?? null,
    missionType: l.mission?.type ?? null,
    missionDescription: l.mission?.description ?? null,
    orbit: l.mission?.orbit?.name ?? null,
    padName: l.pad?.name ?? null,
    padLat: num(l.pad?.latitude),
    padLon: num(l.pad?.longitude),
    locationName: l.pad?.location?.name ?? null,
    locationTz: l.pad?.location?.timezone_name ?? null,
    countryCode: l.pad?.country?.alpha_2_code ?? null,
    webcastLive: !!l.webcast_live,
    vidUrls: vids.filter((v) => (seen.has(v.url) ? false : (seen.add(v.url), true))),
    infoUrls: [...links(l.info_urls), ...links(l.mission?.info_urls)].map(({ url, title }) => ({ url, title })),
    imageUrl: l.image?.image_url ?? null,
    imageCredit: l.image?.credit ?? null,
    patches: (l.mission_patches ?? []).flatMap((p) => (p?.image_url ? [{ name: String(p.name ?? "Mission patch"), imageUrl: String(p.image_url) }] : [])),
    timeline: (l.timeline ?? []).flatMap((e) => {
      const rel = parseIsoDuration(e?.relative_time);
      return rel == null ? [] : [{ abbrev: String(e?.type?.abbrev ?? "Event"), description: e?.type?.description ?? undefined, relativeSeconds: rel }];
    }),
    probability: l.probability ?? null,
    failReason: l.failreason || null,
    upstreamUpdatedAt: iso(l.last_updated),
  };
}
