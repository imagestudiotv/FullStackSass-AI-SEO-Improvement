-- Publication dispatch boundary, operator controls, authority metrics and
-- value estimates.
--
-- Additive only: four new tables and four nullable columns. No default of
-- an existing column changes and no existing row is updated, so a build
-- older than this migration keeps working against it (see
-- docs/managed-network.md, "Deploy, migrate, roll back").
--
--   publication_dispatches - one row per attempt to send an article
--     revision to a customer's site; at most one in flight per article.
--   platform_controls      - publication_freeze and managed_review switches
--     (a missing row is "disabled").
--   domain_metrics         - provider-labelled authority per domain.
--   valuation_policies     - versioned estimate rates; none = not configured.
CREATE TABLE "domain_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"provider" text NOT NULL,
	"metric" text NOT NULL,
	"scale_max" integer NOT NULL,
	"value" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"observed_at" timestamp,
	"attempted_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_controls" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"trigger" text NOT NULL,
	"revision_hash" text NOT NULL,
	"requested_status" text NOT NULL,
	"status" text DEFAULT 'in_flight' NOT NULL,
	"owner" text,
	"remote_id" text,
	"remote_url" text,
	"error" text,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "valuation_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"currency" text NOT NULL,
	"click_value_mode" text DEFAULT 'none' NOT NULL,
	"fixed_click_rate" numeric(10, 2),
	"backlink_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" text NOT NULL,
	"notes" text,
	"effective_from" timestamp NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_checks" ADD COLUMN "rel" text;--> statement-breakpoint
ALTER TABLE "link_checks" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "network_sites" ADD COLUMN "min_source_rank" integer;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "recheck_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD CONSTRAINT "publication_dispatches_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD CONSTRAINT "publication_dispatches_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "domain_metrics_domain_metric_uidx" ON "domain_metrics" USING btree ("domain","provider","metric");--> statement-breakpoint
CREATE INDEX "domain_metrics_due_idx" ON "domain_metrics" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "publication_dispatches_article_idx" ON "publication_dispatches" USING btree ("article_id","claimed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_dispatches_in_flight_uidx" ON "publication_dispatches" USING btree ("article_id") WHERE "publication_dispatches"."status" = 'in_flight';--> statement-breakpoint
CREATE UNIQUE INDEX "valuation_policies_version_uidx" ON "valuation_policies" USING btree ("version");--> statement-breakpoint
-- Like every table since 0034: reachable only through the server's own
-- connection, never through Supabase's anon/authenticated roles.
ALTER TABLE "domain_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_controls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "valuation_policies" ENABLE ROW LEVEL SECURITY;
