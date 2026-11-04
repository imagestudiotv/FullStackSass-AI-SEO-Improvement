DROP INDEX "plans_tier_interval_uidx";--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "social_post_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "catalog_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_tier_interval_version_uidx" ON "plans" USING btree ("tier","interval","catalog_version");