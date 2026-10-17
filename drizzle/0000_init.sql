CREATE TABLE "delivery_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"launch_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"launch_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "launch_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"launch_id" text NOT NULL,
	"kind" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"status_abbrev" text NOT NULL,
	"status_name" text NOT NULL,
	"net" timestamp with time zone NOT NULL,
	"net_precision" text,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"operator_name" text,
	"operator_abbrev" text,
	"operator_type" text,
	"customers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rocket_name" text,
	"rocket_family" text,
	"mission_name" text,
	"mission_type" text,
	"mission_description" text,
	"orbit" text,
	"pad_name" text,
	"pad_lat" double precision,
	"pad_lon" double precision,
	"location_name" text,
	"location_tz" text,
	"country_code" text,
	"webcast_live" boolean DEFAULT false NOT NULL,
	"vid_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"info_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"image_credit" text,
	"patches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"probability" integer,
	"fail_reason" text,
	"upstream_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"channel" text NOT NULL,
	"endpoint" text,
	"p256dh" text,
	"auth" text,
	"scope" text NOT NULL,
	"target" text,
	"lead_minutes" jsonb DEFAULT '[60,10]'::jsonb NOT NULL,
	"notify_changes" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_events_dedupe" ON "delivery_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "delivery_events_status_idx" ON "delivery_events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_dedupe" ON "inbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "inbox_client_idx" ON "inbox" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "launch_updates_dedupe" ON "launch_updates" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "launch_updates_launch_idx" ON "launch_updates" USING btree ("launch_id");--> statement-breakpoint
CREATE INDEX "launches_net_idx" ON "launches" USING btree ("net");--> statement-breakpoint
CREATE INDEX "subscriptions_client_idx" ON "subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_unique" ON "subscriptions" USING btree ("client_id","channel","scope","target");