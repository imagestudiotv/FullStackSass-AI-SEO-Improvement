CREATE TABLE "website_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"invited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "subscriptions_organization_id_uidx";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "website_id" uuid;--> statement-breakpoint
ALTER TABLE "website_members" ADD CONSTRAINT "website_members_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_members" ADD CONSTRAINT "website_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_members" ADD CONSTRAINT "website_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "website_members_site_user_uidx" ON "website_members" USING btree ("website_id","user_id");--> statement-breakpoint
CREATE INDEX "website_members_user_idx" ON "website_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_website_id_uidx" ON "subscriptions" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" USING btree ("organization_id");

--> statement-breakpoint
-- Attach each existing subscription to its workspace's oldest website.
-- Subscriptions used to be per organization, so one covered every site the
-- workspace owned; the oldest is the one it was bought for. A workspace
-- with no website leaves it null, which the unique index permits because
-- Postgres treats nulls as distinct.
UPDATE subscriptions s SET website_id = (
  SELECT w.id FROM websites w
  WHERE w.organization_id = s.organization_id
  ORDER BY w.created_at ASC LIMIT 1
) WHERE s.website_id IS NULL;
