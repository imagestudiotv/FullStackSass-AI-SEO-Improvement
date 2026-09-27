CREATE TABLE "spend_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "spend_quotas_key_window_key" ON "spend_quotas" USING btree ("key","window_start");--> statement-breakpoint
CREATE INDEX "spend_quotas_window_idx" ON "spend_quotas" USING btree ("window_start");--> statement-breakpoint
-- Same as every other table (see 0026): RLS on, no policies. The app connects
-- with bypassrls; nothing else should read reservation counters.
ALTER TABLE "spend_quotas" ENABLE ROW LEVEL SECURITY;
