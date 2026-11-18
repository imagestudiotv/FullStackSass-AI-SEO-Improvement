CREATE TABLE "meta_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" uuid,
	"checkout_id" uuid,
	"visitor" jsonb,
	"pixel_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claimed_until" timestamp,
	"delivered_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_purchases_status_check" CHECK ("meta_purchases"."status" in ('pending', 'delivered', 'suppressed', 'legacy', 'expired')),
	CONSTRAINT "meta_purchases_attempts_check" CHECK ("meta_purchases"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "meta_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meta_purchases" ADD CONSTRAINT "meta_purchases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_purchases" ADD CONSTRAINT "meta_purchases_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_purchases" ADD CONSTRAINT "meta_purchases_checkout_id_billing_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."billing_checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meta_purchases_org_uidx" ON "meta_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "meta_purchases_due_idx" ON "meta_purchases" USING btree ("status","next_attempt_at");
--> statement-breakpoint
-- Cutover baseline, deliberately non-reporting, as 0094 did for Google:
-- every workspace that already paid for a subscription is historical, so
-- the Conversions API never sends an old sale as a new Purchase.
INSERT INTO "meta_purchases" ("organization_id", "payment_id", "status", "occurred_at", "last_error")
SELECT DISTINCT ON ("organization_id") "organization_id", "id", 'legacy', "paid_at", 'pre_cutover_customer'
FROM "payments"
WHERE "amount_cents" > 0 AND "status" IN ('paid', 'refunded') AND "provider_subscription_id" IS NOT NULL
ORDER BY "organization_id", "paid_at", "created_at", "id"
ON CONFLICT ("organization_id") DO NOTHING;
