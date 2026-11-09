-- DRAFT, not a canonical migration (payment session, 2026-11-07). Review P3.
-- The CREATE/ALTER/INDEX lines mirror schema.ts; the INSERT is a hand-written
-- backfill the integrator must carry into the canonical migration (drizzle-kit
-- does not generate data statements).
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
	CONSTRAINT "paypal_plan_versions_kind_check" CHECK ("paypal_plan_versions"."kind" in ('regular', 'trial')),
	CONSTRAINT "paypal_plan_versions_environment_check" CHECK ("paypal_plan_versions"."environment" is null or "paypal_plan_versions"."environment" in ('live', 'sandbox'))
);
--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paypal_plan_versions" ADD CONSTRAINT "paypal_plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_plan_versions_paypal_uidx" ON "paypal_plan_versions" USING btree ("paypal_plan_id");--> statement-breakpoint
CREATE INDEX "paypal_plan_versions_plan_idx" ON "paypal_plan_versions" USING btree ("plan_id");--> statement-breakpoint
-- Backfill: every PayPal id a plan row holds today. Mode unknown here (null).
INSERT INTO "paypal_plan_versions" ("plan_id", "environment", "kind", "paypal_plan_id", "price_cents", "currency")
SELECT "id", NULL, 'regular', "paypal_plan_id", "price_cents", "currency" FROM "plans" WHERE "paypal_plan_id" IS NOT NULL
UNION ALL
SELECT "id", NULL, 'trial', "paypal_trial_plan_id", "price_cents", "currency" FROM "plans" WHERE "paypal_trial_plan_id" IS NOT NULL
ON CONFLICT ("paypal_plan_id") DO NOTHING;
