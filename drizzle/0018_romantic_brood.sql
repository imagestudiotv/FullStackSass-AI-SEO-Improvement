ALTER TABLE "websites" ADD COLUMN "generation_mode" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "publishing_days" jsonb;--> statement-breakpoint
--
-- Websites that existed before this feature stay manual.
--
-- The column default is 'automatic' because that is right for a NEW website:
-- the product is sold as autopilot. It is not right for a site somebody
-- created weeks ago under the old behaviour — switching it on for them would
-- start spending their plan on articles they never asked for, and the first
-- they would know is an article appearing on their website.
--
-- Safe to run twice: after this, new rows take the default and are unaffected
-- by the WHERE clause because they are created after it has run.
--
UPDATE "websites" SET "generation_mode" = 'manual';
