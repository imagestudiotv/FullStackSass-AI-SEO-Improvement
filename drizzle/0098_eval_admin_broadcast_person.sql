ALTER TABLE "email_broadcasts" DROP CONSTRAINT "email_broadcasts_audience_check";--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD COLUMN "heading" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_person_id_user_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_audience_check" CHECK ("email_broadcasts"."audience" in ('all', 'free', 'paid', 'inactive', 'person'));