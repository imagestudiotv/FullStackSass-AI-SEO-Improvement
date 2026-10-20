DROP INDEX "blog_autopilot_runs_scheduled_day_uidx";--> statement-breakpoint
ALTER TABLE "blog_autopilot" ADD COLUMN "articles_per_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_autopilot_runs" ADD COLUMN "slot" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_autopilot_runs_scheduled_slot_uidx" ON "blog_autopilot_runs" USING btree ("run_date","slot") WHERE "blog_autopilot_runs"."trigger" = 'schedule';