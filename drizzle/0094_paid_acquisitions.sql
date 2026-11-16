CREATE TABLE "paid_acquisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" uuid,
	"checkout_id" uuid,
	"visitor" jsonb,
	"measurement_id" text,
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
	CONSTRAINT "paid_acquisitions_status_check" CHECK ("paid_acquisitions"."status" in ('pending', 'delivered', 'suppressed', 'legacy', 'expired')),
	CONSTRAINT "paid_acquisitions_attempts_check" CHECK ("paid_acquisitions"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "paid_acquisitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_acquisitions" ADD CONSTRAINT "paid_acquisitions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_acquisitions" ADD CONSTRAINT "paid_acquisitions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_acquisitions" ADD CONSTRAINT "paid_acquisitions_checkout_id_billing_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."billing_checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_acquisitions_org_uidx" ON "paid_acquisitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "paid_acquisitions_due_idx" ON "paid_acquisitions" USING btree ("status","next_attempt_at");
--> statement-breakpoint
-- Cutover baseline, deliberately non-reporting. Existing paid/refunded money
-- makes a workspace historical even when its old checkout has no GA identity.
-- Never replay old sales (or uncertain legacy purchaseSentAt markers) into Ads.
INSERT INTO "paid_acquisitions" ("organization_id", "payment_id", "status", "occurred_at", "last_error")
SELECT DISTINCT ON ("organization_id") "organization_id", "id", 'legacy', "paid_at", 'pre_cutover_customer'
FROM "payments"
WHERE "amount_cents" > 0 AND "status" IN ('paid', 'refunded')
ORDER BY "organization_id", "paid_at", "created_at", "id"
ON CONFLICT ("organization_id") DO NOTHING;
