-- DRAFT, not a canonical migration (payment session, 2026-11-07).
-- Mirrors the schema.ts change for refunds. The integrator generates the
-- canonical migration from the combined schema and then deletes this folder;
-- until then the test harnesses apply it after drizzle/ (src/test/drafts.ts).
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
ALTER TABLE "payments" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_object" text;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_operation_uidx" ON "payment_refunds" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_provider_uidx" ON "payment_refunds" USING btree ("provider","provider_refund_id") WHERE "payment_refunds"."provider_refund_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_idx" ON "payment_refunds" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_check" CHECK ("payments"."refunded_cents" >= 0 and "payments"."refunded_cents" <= greatest("payments"."amount_cents", 0));
