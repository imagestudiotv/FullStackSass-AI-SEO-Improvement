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
CREATE TABLE "success_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"logo_url" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category_label" text,
	"body_html" text DEFAULT '' NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discover_slug" text,
	"seo_title" text,
	"seo_description" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "success_stories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "support_chat_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"welcomed_at" timestamp,
	"welcome_opened_at" timestamp,
	"welcome_dismissed_at" timestamp,
	"welcome_answered_at" timestamp,
	"onboarding_completed_at" timestamp,
	"first_message_at" timestamp,
	"last_message_at" timestamp,
	"support_requests" integer DEFAULT 0 NOT NULL,
	"last_request_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_chat_state_requests_check" CHECK ("support_chat_state"."support_requests" >= 0)
);
--> statement-breakpoint
ALTER TABLE "support_chat_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_accounts" ADD CONSTRAINT "free_plan_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_events" ADD CONSTRAINT "free_plan_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_plan_events" ADD CONSTRAINT "free_plan_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_state" ADD CONSTRAINT "support_chat_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_chat_state" ADD CONSTRAINT "support_chat_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_org_uidx" ON "free_plan_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_website_uidx" ON "free_plan_accounts" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "free_plan_accounts_domain_uidx" ON "free_plan_accounts" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "free_plan_accounts_started_idx" ON "free_plan_accounts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "free_plan_events_org_kind_idx" ON "free_plan_events" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "success_stories_slug_uidx" ON "success_stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "success_stories_published_order_idx" ON "success_stories" USING btree ("published","sort_order");--> statement-breakpoint
CREATE INDEX "support_chat_state_welcomed_idx" ON "support_chat_state" USING btree ("welcomed_at");