"use server";

import { randomUUID } from "node:crypto";

import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { emailServiceOrdered } from "@/lib/addons/notify";
import { chargeCredits } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { addonPurchases, addons } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format } from "@/lib/i18n/format";
import { notify } from "@/lib/notifications/create";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { stripeErrorMessage } from "@/lib/stripe/errors";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";
import type { AddonRow, PurchaseRow } from "@/lib/addons/shared";

/**
 * Add-on purchases.
 *
 * Money buys two things only: the plan, and credit packs (client, 2026-10-26:
 * "everything can be purchased by credits now ... All this will still exists
 * but will be possible to purchase and use with credits"). So a credit pack
 * is paid by card - and nothing here grants it: the Stripe webhook does,
 * because a customer can close the tab before the success redirect loads, or
 * visit the success URL by hand - while a service delivered by hand is bought
 * with credits (buyAddonWithCredits), and a quote is agreed first and then
 * paid with credits too.
 */

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/+$/, "");
}

export async function listAddons(): Promise<AddonRow[]> {
  /*
    Guarded like every other action in this file. The catalogue is not secret
    — it is the same list the marketing site shows — but a server action is a
    public endpoint that reads the database, and "this particular table is
    harmless" is the reasoning that leaves the next unguarded query behind.
  */
  await requireOrg();

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
      creditPrice: addons.creditPrice,
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
      creditsPaid: addonPurchases.creditsPaid,
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
      kind: addons.kind,
      stripePriceId: addons.stripePriceId,
      isActive: addons.isActive,
    })
    .from(addons)
    .where(eq(addons.id, addonId))
    .limit(1);

  if (!addon || !addon.isActive) {
    return { error: "That add-on is not available" };
  }
  // Only credit packs are paid by card. A service may still have a Stripe price from before; it is not used.
  if (addon.kind !== "credits") {
    return { error: `"${addon.name}" is bought with credits` };
  }
  if (!addon.stripePriceId) {
    return { error: `"${addon.name}" has no price configured yet` };
  }

  // See createCheckoutSession: an error escaping a server action reaches the
  // browser as a 500 plus React error #441, with Stripe's actual explanation
  // stripped out by the production build.
  try {
    const customerId = await getOrCreateCustomer(orgId);
    const base = appUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: addon.stripePriceId, quantity: 1 }],
      success_url: `${base}/billing?addon=success`,
      cancel_url: `${base}/billing?addon=cancelled`,
      /**
       * A promotion code box here too, as on the subscription checkout.
       *
       * Without it a code that works on a plan silently fails on an add-on:
       * the customer is told "use CODE at checkout", finds no box, and
       * concludes the offer was a lie. Promotions are usually run across the
       * whole product, not per line item, so the two checkouts have to agree.
       *
       * It only renders the input — which codes exist, and what they apply
       * to, is configured in the Stripe dashboard.
       */
      allow_promotion_codes: true,
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
  } catch (error) {
    console.error("[addons] checkout session failed", error);
    return { error: stripeErrorMessage(error) };
  }
}

export type CreditPurchaseResult = { ok: true; credits: number } | { ok: false; error: string; needsCredits?: boolean };

/**
 * Buys a service with the workspace's credits.
 *
 * The credits are taken and the purchase recorded in ONE transaction, so
 * neither exists without the other. Each click is a new purchase (a random
 * key): buying the same service twice is allowed, as it was by card, and the
 * button is disabled while one is in flight. The service is delivered by
 * hand, so the administrators are emailed, and the purchase reads "in
 * progress" on Billing until it is delivered.
 */
export async function buyAddonWithCredits(addonId: string): Promise<CreditPurchaseResult> {
  const { orgId, userId } = await requireOrg();
  const { t } = await getAppMessages(userId);

  // Credits are the reader's own workspace's; someone here only for another's website has none to spend.
  if (await hasOnlySharedWork()) return { ok: false, error: t.app.credits.guestOnly };

  const [addon] = await db
    .select({
      id: addons.id,
      slug: addons.slug,
      name: addons.name,
      kind: addons.kind,
      creditPrice: addons.creditPrice,
      currency: addons.currency,
      isActive: addons.isActive,
    })
    .from(addons)
    .where(eq(addons.id, addonId))
    .limit(1);
  // A quote is not bought from a list price: it is agreed first.
  if (!addon || !addon.isActive || addon.kind !== "service" || !addon.creditPrice || addon.creditPrice <= 0) {
    return { ok: false, error: t.app.addons.unavailable };
  }
  const price = addon.creditPrice;

  const purchaseId = randomUUID();
  const outcome = await db.transaction(async (tx) => {
    const spend = await chargeCredits(tx, {
      organizationId: orgId,
      action: `addon:${addon.slug}`,
      credits: price,
      key: `addon:${purchaseId}`,
      note: `Bought ${addon.name}`,
    });
    if (!spend.ok) return spend;
    await tx.insert(addonPurchases).values({
      id: purchaseId,
      organizationId: orgId,
      addonId: addon.id,
      stripeSessionId: null,
      pricePaidCents: 0,
      currency: addon.currency,
      creditsPaid: price,
      status: "paid",
    });
    return spend;
  });
  if (!outcome.ok) {
    return {
      ok: false,
      needsCredits: true,
      error: format(t.app.credits.notEnough, { price: outcome.price, available: outcome.available }),
    };
  }

  /* After commit, and never able to undo the purchase. */
  await notify({
    organizationId: orgId,
    type: "addon.purchased",
    title: `${addon.name} - order received`,
    body: "We will start work and email you when it is done.",
    href: "/billing",
  });
  await emailServiceOrdered({ organizationId: orgId, service: addon.name, credits: price });

  revalidatePath("/billing");
  revalidatePath("/credits");
  // The sidebar shows the balance on every page.
  revalidatePath("/", "layout");
  return { ok: true, credits: price };
}
