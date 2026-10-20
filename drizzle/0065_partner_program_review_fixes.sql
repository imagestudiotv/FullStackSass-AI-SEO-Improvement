DROP INDEX "partner_settlements_run_uidx";--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD COLUMN "resumed_at" timestamp;--> statement-breakpoint
ALTER TABLE "partner_signup_eligibility" ADD COLUMN "signup_network_hash" text;--> statement-breakpoint
ALTER TABLE "partner_signup_eligibility" ADD COLUMN "signup_device_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_settlements_run_uidx" ON "partner_settlements" USING btree ("partner_id","environment","currency","run_key") WHERE "partner_settlements"."state" <> 'canceled';