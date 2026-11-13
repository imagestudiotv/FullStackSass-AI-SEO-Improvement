-- Nov 13 ticket, area "ads": rewarded ads on Earn Credits (lib/earn/rewarded-ads.ts).
-- Hand-written draft. Additive and idempotent. The coordinator numbers it and
-- regenerates it with drizzle-kit; this file only has to match schema.ts.
CREATE TABLE IF NOT EXISTS "rewarded_ad_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"reason" text,
	"reward_credits" integer NOT NULL,
	"day" date NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rewarded_ad_views_reward_check" CHECK ("rewarded_ad_views"."reward_credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "rewarded_ad_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "rewarded_ad_views" ADD CONSTRAINT "rewarded_ad_views_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "rewarded_ad_views" ADD CONSTRAINT "rewarded_ad_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rewarded_ad_views_one_open_uidx" ON "rewarded_ad_views" USING btree ("user_id") WHERE "rewarded_ad_views"."status" = 'started';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_user_day_idx" ON "rewarded_ad_views" USING btree ("user_id","day","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_org_day_idx" ON "rewarded_ad_views" USING btree ("organization_id","day","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rewarded_ad_views_day_idx" ON "rewarded_ad_views" USING btree ("day","status");
