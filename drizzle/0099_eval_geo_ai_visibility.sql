-- AI visibility that measures something (PR 4 of the 2026-11-27 review):
-- questions in the website's language, several answers per question and
-- assistant, and what each answer was asked with. Columns only, all nullable:
-- older rows keep meaning what they meant (one answer, English questions).
-- Safe to run twice. Numbered 0099 after 0098_eval_admin_broadcast_person (test/eval-integration).
ALTER TABLE "geo_prompts" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN IF NOT EXISTS "samples" integer;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN IF NOT EXISTS "mention_count" integer;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN IF NOT EXISTS "weight" real;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN IF NOT EXISTS "average_position" real;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN IF NOT EXISTS "answers" jsonb;
