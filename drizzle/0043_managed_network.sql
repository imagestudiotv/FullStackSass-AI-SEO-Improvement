-- Managed Partner Network: new-site defaults, the admin review gate on
-- articles, provenance on placements, and target-page preferences.
--
-- Additive only, and no column DEFAULT changes: the new-site defaults
-- (publish live, table of contents, similar products) are written
-- explicitly by the new application code when it creates a website
-- (lib/websites/new-site-defaults.ts). A changed database default would also
-- apply to websites created by OLD instances still running during a deploy,
-- and after a rollback. No existing row is updated. review_status is null for
-- every existing article, which keeps it out of the review gate.
-- See docs/managed-network.md.
CREATE TABLE "backlink_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"url" text NOT NULL,
	"note" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_status" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_approved_by" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "review_approved_hash" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "backlink_targets" ADD CONSTRAINT "backlink_targets_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "backlink_targets_site_url_uidx" ON "backlink_targets" USING btree ("website_id","url");--> statement-breakpoint
-- Like every table since 0034: reachable only through the server's own
-- connection, never through Supabase's anon/authenticated roles.
ALTER TABLE "backlink_targets" ENABLE ROW LEVEL SECURITY;
