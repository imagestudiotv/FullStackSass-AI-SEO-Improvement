CREATE TABLE "email_broadcast_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp,
	"claimed_at" timestamp,
	"sent_at" timestamp,
	"provider_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_broadcast_recipients_status_check" CHECK ("email_broadcast_recipients"."status" in ('queued', 'sending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "email_broadcast_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"subject" text NOT NULL,
	"preview_text" text DEFAULT '' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"recipient_count" integer,
	"created_by" text NOT NULL,
	"updated_by" text,
	"sent_by" text,
	"cancelled_by" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_broadcasts_status_check" CHECK ("email_broadcasts"."status" in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
	CONSTRAINT "email_broadcasts_audience_check" CHECK ("email_broadcasts"."audience" in ('all', 'free', 'paid', 'inactive')),
	CONSTRAINT "email_broadcasts_scheduled_check" CHECK ("email_broadcasts"."status" <> 'scheduled' or "email_broadcasts"."scheduled_for" is not null)
);
--> statement-breakpoint
ALTER TABLE "email_broadcasts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_broadcast_recipients" ADD CONSTRAINT "email_broadcast_recipients_broadcast_id_email_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."email_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_broadcast_recipients" ADD CONSTRAINT "email_broadcast_recipients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_broadcast_recipients_once_uidx" ON "email_broadcast_recipients" USING btree ("broadcast_id","user_id");--> statement-breakpoint
CREATE INDEX "email_broadcast_recipients_queue_idx" ON "email_broadcast_recipients" USING btree ("broadcast_id","status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_broadcast_recipients_user_idx" ON "email_broadcast_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_broadcasts_status_idx" ON "email_broadcasts" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "email_broadcasts_created_idx" ON "email_broadcasts" USING btree ("created_at");