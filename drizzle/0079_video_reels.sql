CREATE TABLE "video_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"day" date NOT NULL,
	"format" text DEFAULT 'reel' NOT NULL,
	"style" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"script" jsonb NOT NULL,
	"caption" text NOT NULL,
	"article_id" uuid,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice" text,
	"music_track" text,
	"captions" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"approved_at" timestamp,
	"credit_spend_key" text,
	"voice_url" text,
	"timing" jsonb,
	"duration_ms" integer,
	"video_url" text,
	"slide_urls" jsonb,
	"cover_url" text,
	"platforms" jsonb,
	"scheduled_for" timestamp,
	"bundle_post_id" text,
	"posted_urls" jsonb,
	"stats" jsonb,
	"stats_at" timestamp,
	"milestone_at" timestamp,
	"files_deleted_at" timestamp,
	"error" text,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "video_settings" (
	"website_id" uuid PRIMARY KEY NOT NULL,
	"style" text DEFAULT 'bold' NOT NULL,
	"voice" text DEFAULT 'coral',
	"music" boolean DEFAULT true NOT NULL,
	"captions" boolean DEFAULT true NOT NULL,
	"publish_mode" text DEFAULT 'manual' NOT NULL,
	"platforms" jsonb DEFAULT '["instagram","tiktok","youtube","facebook"]'::jsonb NOT NULL,
	"logo_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_ideas" ADD CONSTRAINT "video_ideas_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_media" ADD CONSTRAINT "video_media_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_settings" ADD CONSTRAINT "video_settings_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_ideas_website_day_idx" ON "video_ideas" USING btree ("website_id","day");--> statement-breakpoint
CREATE INDEX "video_ideas_status_idx" ON "video_ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "video_media_website_idx" ON "video_media" USING btree ("website_id");