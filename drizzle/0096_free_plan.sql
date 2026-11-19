CREATE TABLE "free_plan_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" uuid,
	"domain" text NOT NULL,
	"user_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "free_plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "free_plan_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_events" ADD CONSTRAINT "free_plan_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_events" ADD CONSTRAINT "free_plan_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_org_uidx" ON "free_plan_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_website_uidx" ON "free_plan_accounts" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_domain_uidx" ON "free_plan_accounts" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "free_plan_accounts_started_idx" ON "free_plan_accounts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "free_plan_events_org_kind_idx" ON "free_plan_events" USING btree ("organization_id","kind");