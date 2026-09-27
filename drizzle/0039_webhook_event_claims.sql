-- Webhook delivery gains an explicit lifecycle. See lib/billing/webhook-events.ts.
--
-- status DEFAULTS TO 'completed' on purpose. Every row already in this table was
-- written by the old insert-is-the-lock gate, which only ever recorded an event
-- it was about to handle and deleted the row again if handling threw. So a
-- surviving row means the work finished. Defaulting to 'received' would present
-- the entire history as reclaimable and invite a replay of months of billing
-- events the first time each one was redelivered.
ALTER TABLE "webhook_events" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "last_error" text;--> statement-breakpoint
CREATE INDEX "webhook_events_status_claimed_idx" ON "webhook_events" USING btree ("status","claimed_at");--> statement-breakpoint
-- Historical rows get their original timestamp as the completion time. Not
-- now(): these events finished when they were processed, and dating them to the
-- migration would make every past event look like it completed in one instant.
UPDATE "webhook_events" SET "completed_at" = "processed_at" WHERE "completed_at" IS NULL;
