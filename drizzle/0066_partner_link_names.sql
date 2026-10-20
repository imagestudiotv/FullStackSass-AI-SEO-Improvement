CREATE TABLE "partner_referral_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_email" text,
	"retired_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "partner_referral_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_referral_codes" ADD CONSTRAINT "partner_referral_codes_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_referral_codes_partner_idx" ON "partner_referral_codes" USING btree ("partner_id");--> statement-breakpoint
-- Every existing partner's current link name (none in production yet).
INSERT INTO "partner_referral_codes" ("code", "partner_id", "created_at") SELECT "referral_code", "id", "created_at" FROM "partner_profiles" ON CONFLICT DO NOTHING;
