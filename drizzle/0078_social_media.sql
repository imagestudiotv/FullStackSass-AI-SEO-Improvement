CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"bundle_account_id" text,
	"auto_post" boolean DEFAULT true NOT NULL,
	"target" text,
	"paused_at" timestamp,
	"paused_reason" text,
	"warmup_ends_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "social_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"thread_url" text,
	"thread_title" text,
	"thread_snippet" text,
	"title" text,
	"body" text NOT NULL,
	"image_url" text,
	"link" text,
	"warmup" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"scheduled_for" timestamp,
	"credit_spend_key" text,
	"bundle_post_id" text,
	"posted_url" text,
	"error" text,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "social_teams" (
	"website_id" uuid PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_suggestions" ADD CONSTRAINT "social_suggestions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_teams" ADD CONSTRAINT "social_teams_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_website_platform_uidx" ON "social_accounts" USING btree ("website_id","platform");--> statement-breakpoint
CREATE INDEX "social_suggestions_website_day_idx" ON "social_suggestions" USING btree ("website_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "social_suggestions_thread_uidx" ON "social_suggestions" USING btree ("website_id","thread_url") WHERE "social_suggestions"."thread_url" is not null;