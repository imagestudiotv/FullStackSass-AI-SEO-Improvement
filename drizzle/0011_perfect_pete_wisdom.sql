CREATE TABLE "integration_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"label" text,
	"last_used_at" timestamp,
	"site_info" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_keys" ADD CONSTRAINT "integration_keys_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_keys_hash_key" ON "integration_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "integration_keys_website_idx" ON "integration_keys" USING btree ("website_id");