-- Audit completion, schema half: additive only, and safe to re-run (every
-- statement is IF NOT EXISTS or guarded). Nothing here rewrites or drops data.
--   job_outbox               - durable job intent (issue 16, lib/jobs/outbox.ts)
--   provider_cancellations   - owed provider cancellations (issues 3/9)
--   billing_checkouts.*      - reuse, trial record, idempotent recovery (issue 5)
--   subscriptions.claimed_website_id - which site a detached row was for (5)
--   webhook_events.*         - claim ownership token, recovery schedule (issue 9)
--   payments.*               - the subscription a payment belongs to (issue 6)
--   spend_reservations.*     - spend-started marker, baseline subject (issue 4)
--   credit_ledger.*          - per-operation idempotency key (issues 7/8/11)
--   placements.*, link_checks.outcome - verified backlink states (issue 11)
-- The data half (historical article baseline) is 0041.
CREATE TABLE IF NOT EXISTS "job_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claimed_until" timestamp,
	"last_error" text,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claimed_until" timestamp,
	"last_error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "checkout_url" text;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "trial_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "request_params" jsonb;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "provider_state" text;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD COLUMN IF NOT EXISTS "last_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "link_checks" ADD COLUMN IF NOT EXISTS "outcome" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_subscription_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN IF NOT EXISTS "live_at" timestamp;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "spend_reservations" ADD COLUMN IF NOT EXISTS "spend_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "spend_reservations" ADD COLUMN IF NOT EXISTS "spend_token" uuid;--> statement-breakpoint
ALTER TABLE "spend_reservations" ADD COLUMN IF NOT EXISTS "subject_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "claimed_website_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "claim_token" uuid;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_outbox_event_uidx" ON "job_outbox" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_outbox_due_idx" ON "job_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_cancellations_subscription_uidx" ON "provider_cancellations" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_cancellations_due_idx" ON "provider_cancellations" USING btree ("status","next_attempt_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_idempotency_uidx" ON "credit_ledger" USING btree ("idempotency_key") WHERE "credit_ledger"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_subscription_idx" ON "payments" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spend_reservations_subject_uidx" ON "spend_reservations" USING btree ("operation","key","subject_id") WHERE "spend_reservations"."subject_id" is not null;--> statement-breakpoint
-- Row Level Security, like every other table (see 0026_enable_rls.sql).
ALTER TABLE "job_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_cancellations" ENABLE ROW LEVEL SECURITY;
