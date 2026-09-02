CREATE TABLE "agency_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"site_limit" integer DEFAULT 50 NOT NULL,
	"article_limit" integer DEFAULT 500 NOT NULL,
	"keyword_limit" integer DEFAULT 5000 NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_workspaces" ADD CONSTRAINT "agency_workspaces_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_workspaces_org_key" ON "agency_workspaces" USING btree ("organization_id");