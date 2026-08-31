ALTER TABLE "geo_results" ALTER COLUMN "competitors" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "geo_results" ALTER COLUMN "competitors" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_prompts" ADD COLUMN "is_suggested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN "website_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "geo_results" ADD COLUMN "excerpt" text;--> statement-breakpoint
ALTER TABLE "geo_results" ADD CONSTRAINT "geo_results_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_prompts_website_idx" ON "geo_prompts" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_prompts_website_prompt_key" ON "geo_prompts" USING btree ("website_id","prompt");--> statement-breakpoint
CREATE INDEX "geo_results_website_idx" ON "geo_results" USING btree ("website_id","checked_at");--> statement-breakpoint
CREATE INDEX "geo_results_prompt_idx" ON "geo_results" USING btree ("geo_prompt_id","checked_at");