CREATE TABLE "addon_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"addon_id" uuid NOT NULL,
	"stripe_session_id" text NOT NULL,
	"price_paid_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_price_id" text,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'credits' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "addon_purchases_session_key" ON "addon_purchases" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "addon_purchases_org_idx" ON "addon_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addons_slug_key" ON "addons" USING btree ("slug");