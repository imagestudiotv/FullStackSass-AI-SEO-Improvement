-- DRAFT, not a canonical migration (payment session, 2026-11-07). Review P7.
-- Mirrors partner-tables.ts: which provider collected a payment fact.
ALTER TABLE "partner_payment_facts" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_payment_facts" ADD COLUMN "paypal_subscription_id" text;
