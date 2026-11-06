CREATE TABLE "website_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'quote_requested' NOT NULL,
	"request_key" text NOT NULL,
	"brief" text NOT NULL,
	"existing_url" text,
	"requirements" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"scope" text,
	"credit_cost" integer,
	"quoted_at" timestamp,
	"quoted_by" text,
	"credits_paid" integer,
	"paid_at" timestamp,
	"delivery_note" text,
	"fulfilled_at" timestamp,
	"fulfilled_by" text,
	"decline_reason" text,
	"declined_at" timestamp,
	"declined_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_projects_kind_check" CHECK ("website_projects"."kind" in ('new', 'redesign')),
	CONSTRAINT "website_projects_status_check" CHECK ("website_projects"."status" in ('quote_requested', 'quoted', 'paid', 'fulfilled', 'declined')),
	CONSTRAINT "website_projects_cost_check" CHECK ("website_projects"."credit_cost" is null or "website_projects"."credit_cost" > 0),
	CONSTRAINT "website_projects_priced_check" CHECK ("website_projects"."status" not in ('quoted', 'paid', 'fulfilled') or ("website_projects"."credit_cost" is not null and "website_projects"."scope" is not null)),
	CONSTRAINT "website_projects_paid_check" CHECK ("website_projects"."status" not in ('paid', 'fulfilled') or ("website_projects"."credits_paid" > 0 and "website_projects"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "website_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "website_projects_request_key" ON "website_projects" USING btree ("organization_id","request_key");--> statement-breakpoint
CREATE INDEX "website_projects_org_idx" ON "website_projects" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "website_projects_status_idx" ON "website_projects" USING btree ("status","created_at");--> statement-breakpoint
-- The two options, under the existing add-ons. No price on purpose: kind "quote" is never sold from a list price (lib/website-projects).
INSERT INTO "addons" ("slug", "name", "description", "price_cents", "currency", "credits_granted", "credit_price", "kind", "sort_order", "is_active") VALUES
	('website_new', 'New website', 'Our team builds a website for you. Send a brief and we will agree the scope and quote a price in credits.', 0, 'eur', 0, NULL, 'quote', 30, true),
	('website_redesign', 'Website redesign', 'Our team redesigns your current website. Send a brief and we will agree the scope and quote a price in credits.', 0, 'eur', 0, NULL, 'quote', 31, true)
ON CONFLICT ("slug") DO NOTHING;
