-- DRAFT, not a canonical migration (payment session, 2026-11-07). Review P1.
-- Mirrors schema.ts: paypal_plan_changes, and the plan_upgrade purpose on paypal_orders.
CREATE TABLE "paypal_plan_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"paypal_subscription_id" text NOT NULL,
	"from_plan_id" uuid NOT NULL,
	"to_plan_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"difference_cents" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"order_row_id" uuid,
	"approve_url" text,
	"revision_requested_at" timestamp,
	"approval_signal_at" timestamp,
	"effective_at" timestamp,
	"refund_id" uuid,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_plan_changes_kind_check" CHECK ("paypal_plan_changes"."kind" in ('upgrade', 'downgrade')),
	CONSTRAINT "paypal_plan_changes_status_check" CHECK ("paypal_plan_changes"."status" in ('awaiting_payment', 'awaiting_approval', 'completed', 'refunding', 'refunded', 'cancelled', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "paypal_plan_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paypal_plan_changes" ADD CONSTRAINT "paypal_plan_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_plan_changes_open_uidx" ON "paypal_plan_changes" USING btree ("subscription_id") WHERE "paypal_plan_changes"."status" in ('awaiting_payment', 'awaiting_approval');--> statement-breakpoint
CREATE INDEX "paypal_plan_changes_paypal_subscription_idx" ON "paypal_plan_changes" USING btree ("paypal_subscription_id");--> statement-breakpoint
CREATE INDEX "paypal_plan_changes_status_idx" ON "paypal_plan_changes" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "paypal_orders" DROP CONSTRAINT "paypal_orders_purpose_check";--> statement-breakpoint
ALTER TABLE "paypal_orders" ADD CONSTRAINT "paypal_orders_purpose_check" CHECK ("paypal_orders"."purpose" in ('addon_credits', 'blog_sponsorship', 'plan_upgrade'));
