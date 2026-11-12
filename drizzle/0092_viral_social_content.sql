CREATE TABLE "provider_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"limit_usd" numeric(12, 6) NOT NULL,
	"reserved_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_spend" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "provider_spend_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"key" text NOT NULL,
	"website_id" uuid,
	"idea_id" uuid,
	"amount_usd" numeric(12, 6) NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_spend_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_idea_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"day" date NOT NULL,
	"slot" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"size" integer NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"requested_by" text,
	"requested_via" text,
	"request_key" text,
	"error" text,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_idea_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"at" timestamp NOT NULL,
	"idea_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_schedule_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_stock_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"licence" text NOT NULL,
	"source_url" text,
	"author" text,
	"query" text,
	"cost_usd" numeric(10, 6),
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_stock_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "category" text DEFAULT 'educational' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "direction" text DEFAULT 'animated' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "why" text;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "techniques" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "production" jsonb;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "assets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "claims" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "review_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "reviewed_hash" text;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "cost" jsonb;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "native_audio" jsonb;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "alt_video_url" text;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD COLUMN "destinations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "viral_mix" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "goal" text DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "techniques" jsonb DEFAULT '["curiosity_hooks","trend_inspired","myth_busting"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "trend_inspired" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "priority_topics" text;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "tone_preset" text DEFAULT 'professional' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "humor" text DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "allow_controversial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "strong_language" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "require_fact_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "require_controversy_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "formats" jsonb DEFAULT '["reel","story","carousel"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "duration" text DEFAULT '30-45' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "audio_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "narration" text DEFAULT 'natural' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "caption_style" text DEFAULT 'bold' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "music_direction" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "show_hook" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "include_cta" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "default_cta" text;--> statement-breakpoint
ALTER TABLE "video_settings" ADD COLUMN "frequency" text;--> statement-breakpoint
ALTER TABLE "provider_spend_events" ADD CONSTRAINT "provider_spend_events_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_idea_batches" ADD CONSTRAINT "video_idea_batches_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_schedule_slots" ADD CONSTRAINT "video_schedule_slots_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_schedule_slots" ADD CONSTRAINT "video_schedule_slots_idea_id_video_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."video_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_spend_scope_period_uq" ON "provider_spend" USING btree ("scope","period");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_spend_events_key_uq" ON "provider_spend_events" USING btree ("key");--> statement-breakpoint
CREATE INDEX "provider_spend_events_period_idx" ON "provider_spend_events" USING btree ("scope","period");--> statement-breakpoint
CREATE UNIQUE INDEX "video_idea_batches_slot_uq" ON "video_idea_batches" USING btree ("website_id","day","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "video_idea_batches_key_uq" ON "video_idea_batches" USING btree ("website_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_schedule_slots_uq" ON "video_schedule_slots" USING btree ("website_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_schedule_slots_idea_uq" ON "video_schedule_slots" USING btree ("idea_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_stock_assets_provider_uq" ON "video_stock_assets" USING btree ("provider","provider_id","kind");--> statement-breakpoint
ALTER TABLE "video_ideas" ADD CONSTRAINT "video_ideas_batch_id_video_idea_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."video_idea_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_ideas_batch_idx" ON "video_ideas" USING btree ("batch_id");--> statement-breakpoint
/* Backfill (2026-11-12): keep what existing customers chose. Music off stays off; no voice stays without narration. */
UPDATE "video_settings" SET "music_direction" = 'none' WHERE "music" = false;--> statement-breakpoint
UPDATE "video_settings" SET "audio_mode" = 'text_music' WHERE "voice" IS NULL;
