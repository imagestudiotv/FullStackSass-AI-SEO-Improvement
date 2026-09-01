ALTER TABLE "notifications" ADD COLUMN "href" text;--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organization_id","read_at","created_at");