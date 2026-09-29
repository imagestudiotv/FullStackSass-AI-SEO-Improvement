-- One-click WordPress connect (plugin 1.7.0, docs/wordpress-connect.md).
-- Additive only, so a build older than this migration ignores all of it:
--  - plugin_connect_requests: a short-lived row per connection handshake, so
--    the Integration Key travels once, server to server, instead of being
--    copied by hand. Unused rows are deleted once they expire (within 30
--    minutes); used ones a day later.
--  - integration_keys.install_url / install_since / other_install_at: which
--    WordPress install a key belongs to, so "Disconnect" on a staging copy
--    never revokes the live site's key. Null for existing keys until their
--    plugin next reports; nothing is backfilled.

CREATE TABLE "plugin_connect_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"website_id" uuid,
	"created_by_user_id" text,
	"created_session_id" text,
	"link_key_id" uuid,
	"site_url" text,
	"site_host" text,
	"return_url" text,
	"plugin_state" text,
	"code_challenge" text,
	"plugin_version" text,
	"caller_hash" text,
	"presented_key_id" uuid,
	"viewer_session_id" text,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"code_hash" text,
	"code_expires_at" timestamp,
	"consumed_at" timestamp,
	"issued_key_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_keys" ADD COLUMN "install_url" text;--> statement-breakpoint
ALTER TABLE "integration_keys" ADD COLUMN "install_since" timestamp;--> statement-breakpoint
ALTER TABLE "integration_keys" ADD COLUMN "other_install_at" timestamp;--> statement-breakpoint
ALTER TABLE "plugin_connect_requests" ADD CONSTRAINT "plugin_connect_requests_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_connect_requests" ADD CONSTRAINT "plugin_connect_requests_link_key_id_integration_keys_id_fk" FOREIGN KEY ("link_key_id") REFERENCES "public"."integration_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_connect_requests" ADD CONSTRAINT "plugin_connect_requests_presented_key_id_integration_keys_id_fk" FOREIGN KEY ("presented_key_id") REFERENCES "public"."integration_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_connect_requests" ADD CONSTRAINT "plugin_connect_requests_issued_key_id_integration_keys_id_fk" FOREIGN KEY ("issued_key_id") REFERENCES "public"."integration_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plugin_connect_requests_expires_idx" ON "plugin_connect_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "plugin_connect_requests_caller_idx" ON "plugin_connect_requests" USING btree ("caller_hash");--> statement-breakpoint
CREATE INDEX "plugin_connect_requests_issued_key_idx" ON "plugin_connect_requests" USING btree ("issued_key_id");