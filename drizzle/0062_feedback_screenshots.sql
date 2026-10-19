CREATE TABLE "feedback_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"type" text DEFAULT 'image/webp' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_screenshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_screenshots" ADD CONSTRAINT "feedback_screenshots_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_screenshots_feedback_position_uidx" ON "feedback_screenshots" USING btree ("feedback_id","position");--> statement-breakpoint
-- A message's one screenshot from before this migration becomes its picture 1. feedback.screenshot stays until a later migration.
INSERT INTO "feedback_screenshots" ("feedback_id", "position", "data", "type")
SELECT "id", 1, "screenshot", 'image/webp' FROM "feedback" WHERE "screenshot" IS NOT NULL;