CREATE TABLE "email_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tips" boolean DEFAULT true NOT NULL,
	"tips_changed_via" text,
	"signup_locale" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lifecycle_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"user_id" text,
	"scope" text NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"recipient" text,
	"locale" text,
	"status" text DEFAULT 'sending' NOT NULL,
	"reason" text,
	"provider_message_id" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lifecycle_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_emails" ADD CONSTRAINT "lifecycle_emails_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_emails" ADD CONSTRAINT "lifecycle_emails_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_emails_dedupe_uidx" ON "lifecycle_emails" USING btree ("scope","kind","dedupe_key");--> statement-breakpoint
CREATE INDEX "lifecycle_emails_created_idx" ON "lifecycle_emails" USING btree ("created_at");