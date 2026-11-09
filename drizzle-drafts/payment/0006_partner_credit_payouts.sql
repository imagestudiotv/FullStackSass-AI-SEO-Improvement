-- DRAFT, not a canonical migration (payment session, 2026-11-07). Partners paid in credits.
-- Mirrors partner-tables.ts. The destination check is widened for "credits" (neither account).
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
ALTER TABLE "partner_profiles" ADD COLUMN "credit_organization_id" text;--> statement-breakpoint
ALTER TABLE "partner_credit_grants" ADD CONSTRAINT "partner_credit_grants_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_credit_grants" ADD CONSTRAINT "partner_credit_grants_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_credit_grants_settlement_uidx" ON "partner_credit_grants" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_credit_grants_ledger_uidx" ON "partner_credit_grants" USING btree ("ledger_key");--> statement-breakpoint
CREATE INDEX "partner_credit_grants_partner_idx" ON "partner_credit_grants" USING btree ("partner_id","environment","currency");--> statement-breakpoint
ALTER TABLE "partner_settlements" DROP CONSTRAINT "partner_settlements_destination_check";--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_destination_check" CHECK (("partner_settlements"."payout_method" = 'stripe' and "partner_settlements"."stripe_account_id" is not null) or ("partner_settlements"."payout_method" = 'paypal' and "partner_settlements"."paypal_account_id" is not null) or ("partner_settlements"."payout_method" = 'credits' and "partner_settlements"."stripe_account_id" is null and "partner_settlements"."paypal_account_id" is null));
