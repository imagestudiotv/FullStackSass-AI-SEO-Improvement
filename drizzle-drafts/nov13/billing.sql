-- Nov 13 billing: credits bought for a quote (lib/credits/quote-topup.ts).
-- Additive only: one new table and one new, INACTIVE add-on row. Nothing existing changes.
-- Hand-written draft; the coordinator numbers and generates the final migration.
CREATE TABLE IF NOT EXISTS "credit_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"website_project_id" uuid,
	"quote_revision" text NOT NULL,
	"quote_credits" integer NOT NULL,
	"available_credits" integer NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"rate_cents" integer NOT NULL,
	"rate_credits" integer NOT NULL,
	"provider" text NOT NULL,
	"stripe_session_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"addon_purchase_id" uuid,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_topups_amounts_check" CHECK ("credit_topups"."credits" > 0 and "credit_topups"."amount_cents" > 0 and "credit_topups"."rate_cents" > 0 and "credit_topups"."rate_credits" > 0),
	CONSTRAINT "credit_topups_provider_check" CHECK ("credit_topups"."provider" in ('stripe', 'paypal')),
	CONSTRAINT "credit_topups_status_check" CHECK ("credit_topups"."status" in ('open', 'paid', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "credit_topups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_addon_purchase_id_addon_purchases_id_fk" FOREIGN KEY ("addon_purchase_id") REFERENCES "public"."addon_purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_topups_org_idx" ON "credit_topups" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_topups_project_idx" ON "credit_topups" USING btree ("website_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_topups_session_key" ON "credit_topups" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_topups_purchase_key" ON "credit_topups" USING btree ("addon_purchase_id");--> statement-breakpoint
-- The add-on every quote top-up is recorded under (addon_purchases.addon_id is NOT NULL).
-- INACTIVE on purpose: Billing's pack list, stripe:setup, the partner credit rate and buyAddon all read
-- active add-ons only, so it is never sold as a pack, never given a Stripe price, and never sets a rate.
-- credits_granted 0: what a top-up grants is its credit_topups row's credits (lib/addons/fulfil.ts).
INSERT INTO "addons" ("slug", "name", "description", "price_cents", "currency", "credits_granted", "credit_price", "kind", "sort_order", "is_active") VALUES
	('credits_custom', 'Credits for a quote', 'Exactly the credits a quote needs, priced at the smallest credit pack''s rate.', 0, 'eur', 0, NULL, 'credits', 99, false)
ON CONFLICT ("slug") DO NOTHING;
