CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"website_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"origin" text DEFAULT 'app' NOT NULL,
	"code_verifier" text,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_states_website_idx" ON "oauth_states" USING btree ("website_id");--> statement-breakpoint
-- Same as every other table (see 0026): RLS on, no policies. The app connects
-- with bypassrls; a pending OAuth state is a bearer value and nothing outside
-- the app has any business reading one.
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;
