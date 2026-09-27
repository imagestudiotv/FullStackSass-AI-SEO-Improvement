CREATE TABLE "billing_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid,
	"provider" text NOT NULL,
	"plan_id" uuid,
	"stripe_session_id" text,
	"provider_subscription_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_checkouts" ADD CONSTRAINT "billing_checkouts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_checkouts_stripe_session_uidx" ON "billing_checkouts" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "billing_checkouts_website_status_idx" ON "billing_checkouts" USING btree ("website_id","status");--> statement-breakpoint
CREATE INDEX "billing_checkouts_org_status_idx" ON "billing_checkouts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "billing_checkouts_provider_subscription_idx" ON "billing_checkouts" USING btree ("provider_subscription_id");--> statement-breakpoint
-- Same as every other table (see 0026): RLS on, no policies. The app connects
-- with bypassrls; nothing else should read checkout records.
ALTER TABLE "billing_checkouts" ENABLE ROW LEVEL SECURITY;
