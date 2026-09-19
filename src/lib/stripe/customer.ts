import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { billingCustomers, organization } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * One Stripe customer per ORGANIZATION, never per user.
 *
 * The organization is the billing entity: an agency with five members has one
 * customer, and any member hitting the billing page must resolve to the same
 * one. Keying on the user would create a customer per teammate and silently
 * split billing.
 *
 * Stored in `billing_customers`, not on a subscription row. Subscriptions are
 * per WEBSITE since migration 0021, so keeping the customer there forced an
 * empty placeholder subscription into existence before anyone had bought
 * anything — and that insert used ON CONFLICT (organization_id), a unique
 * index the same migration dropped, so the first checkout in any workspace
 * failed with "there is no unique or exclusion constraint matching the ON
 * CONFLICT specification".
 */
export async function getOrCreateCustomer(orgId: string): Promise<string> {
  const [existing] = await db
    .select({ customerId: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, orgId))
    .limit(1);

  /**
   * A stored customer is reused only if it still exists in the CURRENT mode.
   *
   * Test and live are separate datasets. Switching keys — which is normal when
   * setting up a sandbox — leaves a customer id here that the new key cannot
   * see, and passing it to Checkout fails with "No such customer". Verifying
   * first lets us recreate rather than dying on a stale id.
   *
   * Only a genuine "not found" falls through to creation. A network blip or an
   * auth failure is re-thrown, so a transient outage cannot quietly produce a
   * duplicate customer for an organization that already has one.
   */
  if (existing?.customerId) {
    try {
      const customer = await stripe.customers.retrieve(existing.customerId);
      // A deleted customer comes back as an object with deleted: true rather
      // than an error, and cannot be used for checkout.
      if (!customer.deleted) return existing.customerId;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "resource_missing") throw error;
      console.warn(
        `[stripe] customer ${existing.customerId} not found in this mode; creating a new one for org ${orgId}`,
      );
    }
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  const customer = await stripe.customers.create({
    name: org?.name ?? undefined,
    // Lets a webhook recover the tenant even if subscription metadata is lost.
    metadata: { organizationId: orgId },
  });

  /**
   * Upsert on the primary key, so two concurrent first-time callers cannot
   * both insert. The loser's customer is abandoned at Stripe (harmless: a
   * customer with no subscription costs nothing) and BOTH callers go on to
   * use the winner's id, rather than each using the one it created.
   *
   * The stored id is overwritten rather than kept, because reaching this line
   * means the previous one was missing from the current mode — keeping it
   * would send the next caller back down the same failing path.
   */
  const [row] = await db
    .insert(billingCustomers)
    .values({ organizationId: orgId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: billingCustomers.organizationId,
      set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    })
    .returning({ stripeCustomerId: billingCustomers.stripeCustomerId });

  return row?.stripeCustomerId ?? customer.id;
}
