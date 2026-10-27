CREATE TABLE "credit_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_settings_value_check" CHECK ("credit_settings"."value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid,
	"action" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"credits" integer NOT NULL,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_spends_credits_check" CHECK ("credit_spends"."credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "credit_spends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addon_purchases" ALTER COLUMN "stripe_session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD COLUMN "credits_paid" integer;--> statement-breakpoint
ALTER TABLE "addons" ADD COLUMN "credit_price" integer;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_spends" ADD CONSTRAINT "credit_spends_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_spends_idempotency_uidx" ON "credit_spends" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_spends_org_created_idx" ON "credit_spends" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_paid_check" CHECK ("addon_purchases"."stripe_session_id" is not null or "addon_purchases"."credits_paid" > 0);