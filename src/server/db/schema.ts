import { pgTable, text, timestamp, doublePrecision, boolean, jsonb, integer, serial, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";

/** Normalised launch record (source of truth: Launch Library 2 unless `source` says otherwise). */
export const launches = pgTable("launches", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  slug: text("slug"),
  name: text("name").notNull(),
  statusAbbrev: text("status_abbrev").notNull(),
  statusName: text("status_name").notNull(),
  net: timestamp("net", { withTimezone: true }).notNull(),
  netPrecision: text("net_precision"),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  operatorName: text("operator_name"),
  operatorAbbrev: text("operator_abbrev"),
  operatorType: text("operator_type"),
  customers: jsonb("customers").$type<string[]>().notNull().default([]),
  rocketName: text("rocket_name"),
  rocketFamily: text("rocket_family"),
  missionName: text("mission_name"),
  missionType: text("mission_type"),
  missionDescription: text("mission_description"),
  orbit: text("orbit"),
  padName: text("pad_name"),
  padLat: doublePrecision("pad_lat"),
  padLon: doublePrecision("pad_lon"),
  locationName: text("location_name"),
  locationTz: text("location_tz"),
  countryCode: text("country_code"),
  webcastLive: boolean("webcast_live").notNull().default(false),
  vidUrls: jsonb("vid_urls").$type<{ url: string; title?: string; publisher?: string; type?: string; live?: boolean }[]>().notNull().default([]),
  infoUrls: jsonb("info_urls").$type<{ url: string; title?: string }[]>().notNull().default([]),
  imageUrl: text("image_url"),
  imageCredit: text("image_credit"),
  patches: jsonb("patches").$type<{ name: string; imageUrl: string }[]>().notNull().default([]),
  timeline: jsonb("timeline").$type<{ abbrev: string; description?: string; relativeSeconds: number }[]>().notNull().default([]),
  probability: integer("probability"),
  failReason: text("fail_reason"),
  upstreamUpdatedAt: timestamp("upstream_updated_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
}, (t) => [index("launches_net_idx").on(t.net)]);

/** Detected schedule/status changes. */
export const launchUpdates = pgTable("launch_updates", {
  id: serial("id").primaryKey(),
  launchId: text("launch_id").notNull(),
  kind: text("kind").notNull(),
  fromValue: text("from_value"),
  toValue: text("to_value"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  dedupeKey: text("dedupe_key").notNull(),
}, (t) => [uniqueIndex("launch_updates_dedupe").on(t.dedupeKey), index("launch_updates_launch_idx").on(t.launchId)]);

/** Notification subscriptions. Anonymous: keyed by a random client id generated in the browser. */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull(),
  channel: text("channel").notNull(), // 'webpush' | 'inapp'
  endpoint: text("endpoint"),
  p256dh: text("p256dh"),
  auth: text("auth"),
  scope: text("scope").notNull(), // 'launch' | 'operator' | 'all'
  target: text("target"),
  leadMinutes: jsonb("lead_minutes").$type<number[]>().notNull().default([60, 10]),
  notifyChanges: boolean("notify_changes").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("subscriptions_client_idx").on(t.clientId), uniqueIndex("subscriptions_unique").on(t.clientId, t.channel, t.scope, t.target)]);

/** Delivery queue + audit log. dedupe_key guarantees at-most-once per (subscription, event). */
export const deliveryEvents = pgTable("delivery_events", {
  id: serial("id").primaryKey(),
  subscriptionId: uuid("subscription_id").notNull(),
  launchId: text("launch_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  status: text("status").notNull().default("queued"), // queued | sent | failed | skipped
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [uniqueIndex("delivery_events_dedupe").on(t.dedupeKey), index("delivery_events_status_idx").on(t.status)]);

/** In-app notification inbox. */
export const inbox = pgTable("inbox", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  launchId: text("launch_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (t) => [uniqueIndex("inbox_dedupe").on(t.dedupeKey), index("inbox_client_idx").on(t.clientId)]);

/** Last successful refresh per provider feed; survives restarts for staleness reporting. */
export const providerSnapshots = pgTable("provider_snapshots", {
  key: text("key").primaryKey(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastError: text("last_error"),
  requestCount: integer("request_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
});
