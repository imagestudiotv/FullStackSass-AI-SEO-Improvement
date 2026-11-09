-- DRAFT, not a canonical migration (payment session, 2026-11-07). Reviews P4, P8.
-- Mirrors schema.ts: paypal_orders, and the PayPal link on addon_purchases and
-- blog_sponsorships.
CREATE TABLE "paypal_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"purpose" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"paypal_order_id" text,
	"paypal_capture_id" text,
	"approve_url" text,
	"user_id" text,
	"fulfilled_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_orders_purpose_check" CHECK ("paypal_orders"."purpose" in ('addon_credits', 'blog_sponsorship')),
	CONSTRAINT "paypal_orders_status_check" CHECK ("paypal_orders"."status" in ('creating', 'created', 'pending', 'completed', 'failed', 'voided', 'unknown')),
	CONSTRAINT "paypal_orders_amount_check" CHECK ("paypal_orders"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "paypal_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addon_purchases" DROP CONSTRAINT "addon_purchases_paid_check";--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD COLUMN "paypal_order_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_sponsorships" ADD COLUMN "paypal_order_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_order_uidx" ON "paypal_orders" USING btree ("paypal_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_capture_uidx" ON "paypal_orders" USING btree ("paypal_capture_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_open_sponsorship_uidx" ON "paypal_orders" USING btree ("reference_id") WHERE "paypal_orders"."purpose" = 'blog_sponsorship' and "paypal_orders"."status" in ('creating', 'created', 'pending', 'unknown');--> statement-breakpoint
CREATE INDEX "paypal_orders_status_idx" ON "paypal_orders" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "paypal_orders_org_idx" ON "paypal_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addon_purchases_paypal_order_key" ON "addon_purchases" USING btree ("paypal_order_id");--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_paid_check" CHECK ("addon_purchases"."stripe_session_id" is not null or "addon_purchases"."paypal_order_id" is not null or "addon_purchases"."credits_paid" > 0);
