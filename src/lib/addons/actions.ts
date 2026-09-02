"use server";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { addonPurchases, addons } from "@/lib/db/schema";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { requireOrg } from "@/lib/tenant";
import type { AddonRow, PurchaseRow } from "@/lib/addons/shared";

/**
 * Add-on purchases.
 *
 * One-off payments, separate from the subscription: extra link credits, and
 * services we deliver by hand. Nothing here grants anything — the Stripe
 * webhook does that, because a customer can close the tab before the success
 * redirect loads, or visit the success URL by hand.
 */

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/+$/, "");
}

export async function listAddons(): Promise<AddonRow[]> {
  const rows = await db
    .select({
      id: addons.id,
      slug: addons.slug,
      name: addons.name,
      description: addons.description,
      priceCents: addons.priceCents,
      currency: addons.currency,
      creditsGranted: addons.creditsGranted,
      kind: addons.kind,
      // Checkout refuses an add-on without a price, so the UI needs to know
      // rather than offering a button that always errors.
      purchasable: addons.stripePriceId,
    })
    .from(addons)
    .where(eq(addons.isActive, true))
    .orderBy(asc(addons.sortOrder));

  return rows.map((row) => ({
    ...row,
    purchasable: Boolean(row.purchasable),
  }));
}

/** What this workspace has bought. */
export async function listPurchases(): Promise<PurchaseRow[]> {
  const { orgId } = await requireOrg();

  return db
    .select({
      id: addonPurchases.id,
      name: addons.name,
      kind: addons.kind,
      pricePaidCents: addonPurchases.pricePaidCents,
      currency: addonPurchases.currency,
      status: addonPurchases.status,
      fulfilledAt: addonPurchases.fulfilledAt,
      createdAt: addonPurchases.createdAt,
    })
    .from(addonPurchases)
    .innerJoin(addons, eq(addonPurchases.addonId, addons.id))
    .where(eq(addonPurchases.organizationId, orgId))
    .orderBy(desc(addonPurchases.createdAt))
    .limit(25);
}

export type CheckoutResult = { url: string } | { error: string };

/**
 * Starts a one-off checkout.
 *
 * mode "payment", not "subscription": an add-on is bought once. The
 * organisation id goes in the session metadata so the webhook knows who paid —
 * there is no subscription object to carry it on, so this is the only copy.
 */
export async function buyAddon(addonId: string): Promise<CheckoutResult> {
  const { orgId } = await requireOrg();

  if (!isStripeConfigured()) {
    return { error: "Payments are not configured yet." };
  }

  const [addon] = await db
    .select({
      id: addons.id,
      name: addons.name,
      stripePriceId: addons.stripePriceId,
      isActive: addons.isActive,
    })
    .from(addons)
    .where(eq(addons.id, addonId))
    .limit(1);

  if (!addon || !addon.isActive) {
    return { error: "That add-on is not available" };
  }
  if (!addon.stripePriceId) {
    return { error: `"${addon.name}" has no price configured yet` };
  }

  const customerId = await getOrCreateCustomer(orgId);
  const base = appUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: addon.stripePriceId, quantity: 1 }],
    success_url: `${base}/billing?addon=success`,
    cancel_url: `${base}/billing?addon=cancelled`,
    /**
     * The webhook reads both of these. Without them a completed payment
     * arrives with no way to tell which workspace bought what, and the money
     * is taken with nothing granted.
     */
    metadata: { organizationId: orgId, addonId: addon.id },
  });

  if (!session.url) {
    return { error: "Could not start checkout. Please try again." };
  }

  return { url: session.url };
}
