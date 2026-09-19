CREATE TABLE "billing_customers" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Carry across the customer ids already stored on subscription rows.
--
-- Those rows keep their copy: this migration does not drop the column, so a
-- rollback loses nothing and the webhook's old lookup still resolves. One row
-- per organization, so where a workspace somehow has two (possible once the
-- unique index on organization_id was dropped in 0021), the newest wins —
-- that is the customer its most recent checkout used.
INSERT INTO billing_customers (organization_id, stripe_customer_id)
SELECT DISTINCT ON (s.organization_id) s.organization_id, s.stripe_customer_id
FROM subscriptions s
WHERE s.stripe_customer_id IS NOT NULL
ORDER BY s.organization_id, s.created_at DESC
ON CONFLICT (organization_id) DO NOTHING;
