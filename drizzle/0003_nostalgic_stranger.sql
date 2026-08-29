CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "tier" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "currency" text DEFAULT 'eur' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "paypal_plan_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paypal_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
/*
 * Backfill: every pre-existing plan row defaults to tier 'legacy', so the
 * unique index below would fail on rows 2..n. Derive a distinct tier from the
 * name (lowercased, non-alphanumerics collapsed) before creating it.
 * The seed script deactivates anything still prefixed 'legacy-'.
 */
UPDATE "plans"
SET "tier" = 'legacy-' || regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')
WHERE "tier" = 'legacy';--> statement-breakpoint
CREATE UNIQUE INDEX "plans_tier_interval_uidx" ON "plans" USING btree ("tier","interval");--> statement-breakpoint
CREATE INDEX "subscriptions_paypal_subscription_id_idx" ON "subscriptions" USING btree ("paypal_subscription_id");