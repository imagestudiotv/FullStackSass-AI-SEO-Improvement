-- DRAFT, not a canonical migration (payment session, 2026-11-07). Partners paid through PayPal.
-- Mirrors partner-tables.ts. Existing settlements are all "stripe" (the default) and keep
-- their stripe_account_id, so the new check holds for every existing row.
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
ALTER TABLE "partner_profiles" ADD COLUMN "payout_method" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_settlements" ALTER COLUMN "stripe_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD COLUMN "payout_method" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD COLUMN "paypal_account_id" uuid;--> statement-breakpoint
ALTER TABLE "partner_paypal_accounts" ADD CONSTRAINT "partner_paypal_accounts_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_paypal_payouts" ADD CONSTRAINT "partner_paypal_payouts_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_paypal_payouts" ADD CONSTRAINT "partner_paypal_payouts_paypal_account_id_partner_paypal_accounts_id_fk" FOREIGN KEY ("paypal_account_id") REFERENCES "public"."partner_paypal_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_accounts_partner_uidx" ON "partner_paypal_accounts" USING btree ("partner_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_attempt_uidx" ON "partner_paypal_payouts" USING btree ("settlement_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_batch_uidx" ON "partner_paypal_payouts" USING btree ("sender_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_item_uidx" ON "partner_paypal_payouts" USING btree ("payout_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_paypal_payouts_live_uidx" ON "partner_paypal_payouts" USING btree ("settlement_id") WHERE "partner_paypal_payouts"."status" in ('processing', 'unknown', 'pending', 'succeeded', 'reversed');--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_payout_method_check" CHECK ("partner_profiles"."payout_method" in ('stripe', 'paypal'));--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_destination_check" CHECK (("partner_settlements"."payout_method" = 'stripe' and "partner_settlements"."stripe_account_id" is not null) or ("partner_settlements"."payout_method" = 'paypal' and "partner_settlements"."paypal_account_id" is not null));
