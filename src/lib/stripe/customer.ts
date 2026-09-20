import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { billingCustomers, member, organization, user } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * The email of whoever owns this workspace.
 *
 * WITHOUT IT, STRIPE CHECKOUT ASKS FOR AN EMAIL IT ALREADY COULD HAVE KNOWN.
 * Checkout is handed `customer: cus_…` and prefills the email field from that
 * record — but we only ever set `name`, so the field arrived blank and every
 * customer retyped an address we already had. Worse, they could type a
 * different one, sending the receipt somewhere the account does not know.
 *
 * The OWNER's address rather than the current caller's: in an agency where a
 * teammate clicks upgrade, the bill should still reach the person who owns the
 * workspace rather than whoever happened to press the button.
 */
async function ownerEmail(orgId: string): Promise<string | null> {
  const [owner] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, orgId), eq(member.role, "owner")))
    .limit(1);

  if (owner?.email) return owner.email;

  /*
    No row marked "owner" — possible for a workspace created before roles were
    assigned. Any member is a better answer than none: the alternative is a
    blank field on the payment screen.
  */
  const [any] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .limit(1);

  return any?.email ?? null;
}

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
      if (!customer.deleted) {
        /**
         * Backfill an email onto a customer created before we set one.
         *
         * Those records exist and cannot be recreated — they carry the
         * subscriptions — so without this they would keep opening Checkout
         * with an empty email field forever. Only ever fills a BLANK one: an
         * address the customer changed at Stripe is their correction, not
         * ours to overwrite.
         */
        if (!customer.email) {
          const email = await ownerEmail(orgId);
          if (email) {
            await stripe.customers.update(existing.customerId, { email });
          }
        }
        return existing.customerId;
      }
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
    email: (await ownerEmail(orgId)) ?? undefined,
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
