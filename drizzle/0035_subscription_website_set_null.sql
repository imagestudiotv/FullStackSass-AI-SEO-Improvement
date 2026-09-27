-- Deleting a website detaches its subscription instead of deleting it, so the
-- provider ids survive for reconciliation. Website deletion refuses while the
-- subscription could still bill (src/lib/websites/deletion.ts). Existing rows
-- already satisfy the constraint; nothing is rewritten.
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_website_id_websites_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE set null ON UPDATE no action;