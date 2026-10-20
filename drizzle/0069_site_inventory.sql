CREATE TABLE "site_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"remote_id" integer NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"title" text,
	"caption" text,
	"width" integer,
	"height" integer,
	"uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"post_type" text NOT NULL,
	"remote_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"language" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "inventory_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "inventory_status" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "site_languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_images" ADD CONSTRAINT "site_images_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_posts" ADD CONSTRAINT "site_posts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_images_website_remote_uidx" ON "site_images" USING btree ("website_id","remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_posts_website_url_uidx" ON "site_posts" USING btree ("website_id","url");--> statement-breakpoint
CREATE INDEX "site_posts_website_language_idx" ON "site_posts" USING btree ("website_id","language");