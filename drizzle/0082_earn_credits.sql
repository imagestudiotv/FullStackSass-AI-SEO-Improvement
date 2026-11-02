CREATE TABLE "earn_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"link" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reward_credits" integer NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earn_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "earn_submissions" ADD CONSTRAINT "earn_submissions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earn_submissions" ADD CONSTRAINT "earn_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "earn_submissions_once_key" ON "earn_submissions" USING btree ("organization_id","kind") WHERE "earn_submissions"."status" in ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "earn_submissions_status_idx" ON "earn_submissions" USING btree ("status","created_at");