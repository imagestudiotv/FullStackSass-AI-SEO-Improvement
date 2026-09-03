CREATE TABLE "starter_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"article_grant" integer DEFAULT 1 NOT NULL,
	"articles_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "starter_trials" ADD CONSTRAINT "starter_trials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_trials" ADD CONSTRAINT "starter_trials_purchase_id_addon_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."addon_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "starter_trials_org_uidx" ON "starter_trials" USING btree ("organization_id");