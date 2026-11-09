-- DRAFT, not a canonical migration (payment session, 2026-11-07). Review P5: REPGET through PayPal.
-- Mirrors schema.ts: the offer PayPal plans per row, and their kinds in the plan id history.
ALTER TABLE "plans" ADD COLUMN "paypal_offer_plan_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "paypal_trial_offer_plan_id" text;--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" DROP CONSTRAINT "paypal_plan_versions_kind_check";--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" ADD CONSTRAINT "paypal_plan_versions_kind_check" CHECK ("paypal_plan_versions"."kind" in ('regular', 'trial', 'offer', 'trial_offer'));
