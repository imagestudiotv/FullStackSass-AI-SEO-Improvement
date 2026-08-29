import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * One Stripe customer per ORGANIZATION, never per user.
 *
 * The organization is the billing entity: an agency with five members has one
 * subscription, and any member hitting the billing page must resolve to the
 * same customer. Keying on the user would create a customer per teammate and
 * silently split billing.
 */
export async function getOrCreateCustomer(orgId: string): Promise<string> {
  const [existing] = await db
    .select({ id: subscriptions.id, customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, orgId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (existing?.customerId) {
    return existing.customerId;
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

  if (existing) {
    await db
      .update(subscriptions)
      .set({ stripeCustomerId: customer.id })
      .where(eq(subscriptions.id, existing.id));
    return customer.id;
  }

  /**
   * Upsert, not a plain insert: subscriptions.organization_id is unique, so a
   * concurrent first-time caller that inserted between our SELECT and here
   * would otherwise make this throw. On conflict we keep the customer id
   * already stored and return THAT one, so both callers agree on a single
   * customer rather than each using the one it created.
   */
  const [row] = await db
    .insert(subscriptions)
    .values({
      organizationId: orgId,
      stripeCustomerId: customer.id,
      status: "inactive",
    })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: {
        stripeCustomerId: sql`coalesce(${subscriptions.stripeCustomerId}, excluded.stripe_customer_id)`,
      },
    })
    .returning({ stripeCustomerId: subscriptions.stripeCustomerId });

  return row?.stripeCustomerId ?? customer.id;
}
