CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_refund_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"operation_key" text NOT NULL,
	"reason" text,
	"actor" text NOT NULL,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_status_check" CHECK ("payment_refunds"."status" in ('requested', 'pending', 'completed', 'failed', 'unknown')),
	CONSTRAINT "payment_refunds_source_check" CHECK ("payment_refunds"."source" in ('admin', 'provider')),
	CONSTRAINT "payment_refunds_amount_check" CHECK ("payment_refunds"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	CONSTRAINT "paypal_orders_purpose_check" CHECK ("paypal_orders"."purpose" in ('addon_credits', 'blog_sponsorship', 'plan_upgrade')),
	CONSTRAINT "paypal_orders_status_check" CHECK ("paypal_orders"."status" in ('creating', 'created', 'pending', 'completed', 'failed', 'voided', 'unknown')),
	CONSTRAINT "paypal_orders_amount_check" CHECK ("paypal_orders"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "paypal_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "paypal_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"environment" text,
	"kind" text NOT NULL,
	"paypal_plan_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"retired_at" timestamp,
	"pricing_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_plan_versions_kind_check" CHECK ("paypal_plan_versions"."kind" in ('regular', 'trial', 'offer', 'trial_offer')),
	CONSTRAINT "paypal_plan_versions_environment_check" CHECK ("paypal_plan_versions"."environment" is null or "paypal_plan_versions"."environment" in ('live', 'sandbox'))
);
--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"organization_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"credits" integer NOT NULL,
	"pack_cents" integer NOT NULL,
	"pack_credits" integer NOT NULL,
	"ledger_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_credit_grants_amounts_check" CHECK ("partner_credit_grants"."amount" > 0 and "partner_credit_grants"."credits" >= 0 and "partner_credit_grants"."pack_cents" > 0 and "partner_credit_grants"."pack_credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "partner_credit_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_paypal_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"recipient_type" text DEFAULT 'EMAIL' NOT NULL,
	"receiver" text NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"verification_code_hash" text,
	"verification_expires_at" timestamp,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_paypal_accounts_status_check" CHECK ("partner_paypal_accounts"."status" in ('pending_verification', 'verified', 'disabled')),
	CONSTRAINT "partner_paypal_accounts_type_check" CHECK ("partner_paypal_accounts"."recipient_type" in ('EMAIL'))
);
--> statement-breakpoint
ALTER TABLE "partner_paypal_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_paypal_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"environment" text NOT NULL,
	"mode" text NOT NULL,
	"paypal_account_id" uuid NOT NULL,
	"receiver" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"sender_batch_id" text NOT NULL,
	"payout_batch_id" text,
	"payout_item_id" text,
	"transaction_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"provider_status" text,
	"fee" bigint,
	"error" text,
	"recorded_by" text,
	"note" text,
	"submitted_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_paypal_payouts_mode_check" CHECK ("partner_paypal_payouts"."mode" in ('automated', 'manual')),
	CONSTRAINT "partner_paypal_payouts_status_check" CHECK ("partner_paypal_payouts"."status" in ('processing', 'unknown', 'pending', 'succeeded', 'failed', 'reversed')),
	CONSTRAINT "partner_paypal_payouts_amount_check" CHECK ("partner_paypal_payouts"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "partner_paypal_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addon_purchases" DROP CONSTRAINT "addon_purchases_paid_check";--> statement-breakpoint
ALTER TABLE "partner_settlements" ALTER COLUMN "stripe_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD COLUMN "paypal_order_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "featured_image_alt" text;--> statement-breakpoint
ALTER TABLE "blog_sponsorships" ADD COLUMN "paypal_order_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_object" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "paypal_offer_plan_id" text;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "paypal_trial_offer_plan_id" text;--> statement-breakpoint
ALTER TABLE "partner_payment_facts" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_payment_facts" ADD COLUMN "paypal_subscription_id" text;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD COLUMN "payout_method" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD COLUMN "credit_organization_id" text;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD COLUMN "payout_method" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD COLUMN "paypal_account_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_plan_changes" ADD CONSTRAINT "paypal_plan_changes_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" ADD CONSTRAINT "paypal_plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_grants" ADD CONSTRAINT "partner_credit_grants_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_grants" ADD CONSTRAINT "partner_credit_grants_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_paypal_accounts" ADD CONSTRAINT "partner_paypal_accounts_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_paypal_payouts" ADD CONSTRAINT "partner_paypal_payouts_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_paypal_payouts" ADD CONSTRAINT "partner_paypal_payouts_paypal_account_id_partner_paypal_accounts_id_fk" FOREIGN KEY ("paypal_account_id") REFERENCES "public"."partner_paypal_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_operation_uidx" ON "payment_refunds" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_provider_uidx" ON "payment_refunds" USING btree ("provider","provider_refund_id") WHERE "payment_refunds"."provider_refund_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_idx" ON "payment_refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_order_uidx" ON "paypal_orders" USING btree ("paypal_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_capture_uidx" ON "paypal_orders" USING btree ("paypal_capture_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_orders_open_sponsorship_uidx" ON "paypal_orders" USING btree ("reference_id") WHERE "paypal_orders"."purpose" = 'blog_sponsorship' and "paypal_orders"."status" in ('creating', 'created', 'pending', 'unknown');--> statement-breakpoint
CREATE INDEX "paypal_orders_status_idx" ON "paypal_orders" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "paypal_orders_org_idx" ON "paypal_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_plan_changes_open_uidx" ON "paypal_plan_changes" USING btree ("subscription_id") WHERE "paypal_plan_changes"."status" in ('awaiting_payment', 'awaiting_approval');--> statement-breakpoint
CREATE INDEX "paypal_plan_changes_paypal_subscription_idx" ON "paypal_plan_changes" USING btree ("paypal_subscription_id");--> statement-breakpoint
CREATE INDEX "paypal_plan_changes_status_idx" ON "paypal_plan_changes" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_plan_versions_paypal_uidx" ON "paypal_plan_versions" USING btree ("paypal_plan_id");--> statement-breakpoint
CREATE INDEX "paypal_plan_versions_plan_idx" ON "paypal_plan_versions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_credit_grants_settlement_uidx" ON "partner_credit_grants" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_credit_grants_ledger_uidx" ON "partner_credit_grants" USING btree ("ledger_key");--> statement-breakpoint
CREATE INDEX "partner_credit_grants_partner_idx" ON "partner_credit_grants" USING btree ("partner_id","environment","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_accounts_partner_uidx" ON "partner_paypal_accounts" USING btree ("partner_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_attempt_uidx" ON "partner_paypal_payouts" USING btree ("settlement_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_batch_uidx" ON "partner_paypal_payouts" USING btree ("sender_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_item_uidx" ON "partner_paypal_payouts" USING btree ("payout_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_live_uidx" ON "partner_paypal_payouts" USING btree ("settlement_id") WHERE "partner_paypal_payouts"."status" in ('processing', 'unknown', 'pending', 'succeeded', 'reversed');--> statement-breakpoint
CREATE UNIQUE INDEX "addon_purchases_paypal_order_key" ON "addon_purchases" USING btree ("paypal_order_id");--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_paid_check" CHECK ("addon_purchases"."stripe_session_id" is not null or "addon_purchases"."paypal_order_id" is not null or "addon_purchases"."credits_paid" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_check" CHECK ("payments"."refunded_cents" >= 0 and "payments"."refunded_cents" <= greatest("payments"."amount_cents", 0));--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_payout_method_check" CHECK ("partner_profiles"."payout_method" in ('stripe', 'paypal'));--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_destination_check" CHECK (("partner_settlements"."payout_method" = 'stripe' and "partner_settlements"."stripe_account_id" is not null) or ("partner_settlements"."payout_method" = 'paypal' and "partner_settlements"."paypal_account_id" is not null) or ("partner_settlements"."payout_method" = 'credits' and "partner_settlements"."stripe_account_id" is null and "partner_settlements"."paypal_account_id" is null));--> statement-breakpoint
-- Hand-written backfill (payment session's draft 0002; drizzle-kit writes no data statements): every PayPal plan id a plan row holds
-- today goes into paypal_plan_versions, so a subscription on an older id still maps to its plan. Environment unknown here (null).
-- Repeatable: ON CONFLICT on the unique paypal_plan_id does nothing for ids already recorded.
INSERT INTO "paypal_plan_versions" ("plan_id", "environment", "kind", "paypal_plan_id", "price_cents", "currency")
SELECT "id", NULL, 'regular', "paypal_plan_id", "price_cents", "currency" FROM "plans" WHERE "paypal_plan_id" IS NOT NULL
UNION ALL
SELECT "id", NULL, 'trial', "paypal_trial_plan_id", "price_cents", "currency" FROM "plans" WHERE "paypal_trial_plan_id" IS NOT NULL
ON CONFLICT ("paypal_plan_id") DO NOTHING;
