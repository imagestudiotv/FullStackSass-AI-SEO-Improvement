import { eq } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { addonPurchases, addons, starterTrials } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";

/**
 * Fulfilling a paid add-on.
 *
 * Called from the Stripe webhook, never from the success redirect: someone can
 * close the tab before it loads, or visit the success URL by hand. If it is
 * not recorded here, it was not paid for.
 *
 * Imported by a route handler, so no "use server" directive.
 */

export type FulfilInput = {
  organizationId: string;
  addonId: string;
  stripeSessionId: string;
  amountTotal: number | null;
  currency: string | null;
};

/**
 * Records a purchase and grants whatever it includes.
 *
 * Safe to call repeatedly. The unique index on stripe_session_id is the guard:
 * a replayed webhook, or two deliveries racing, insert once and the second
 * gets nothing back — so credits cannot be granted twice for one payment.
 *
 * Returns whether this call was the one that recorded it.
 */
export async function fulfilAddonPurchase(
  input: FulfilInput,
): Promise<boolean> {
  const [addon] = await db
    .select({
      id: addons.id,
      name: addons.name,
      kind: addons.kind,
      creditsGranted: addons.creditsGranted,
      priceCents: addons.priceCents,
      currency: addons.currency,
    })
    .from(addons)
    .where(eq(addons.id, input.addonId))
    .limit(1);

  if (!addon) {
    /**
     * Money was taken for something we cannot identify. Logged loudly rather
     * than thrown: throwing would make Stripe retry forever against an add-on
     * that will never exist, and the payment still needs a human to look at.
     */
    console.error(
      `[addons] paid session ${input.stripeSessionId} references unknown addon ${input.addonId}`,
    );
    return false;
  }

  const inserted = await db
    .insert(addonPurchases)
    .values({
      organizationId: input.organizationId,
      addonId: addon.id,
      stripeSessionId: input.stripeSessionId,
      // What was actually charged, from Stripe, rather than what the row says
      // now — the price may have changed between purchase and this call.
      pricePaidCents: input.amountTotal ?? addon.priceCents,
      currency: input.currency ?? addon.currency,
      status: "paid",
    })
    .onConflictDoNothing({ target: addonPurchases.stripeSessionId })
    .returning({ id: addonPurchases.id });

  // Already recorded: a replay. Nothing more to do, and nothing granted twice.
  if (inserted.length === 0) return false;

  /**
   * The Starter trial grants an article as well as the link credit, so it
   * needs its own row — entitlement is otherwise derived from a subscription,
   * which a trial buyer does not have.
   *
   * onConflictDoNothing on the per-org unique index: someone who somehow pays
   * twice keeps their money's credits (granted below) but does not get a
   * second article grant, and the second payment is visible in purchases for a
   * human to refund.
   */
  if (addon.kind === "trial") {
    await db
      .insert(starterTrials)
      .values({
        organizationId: input.organizationId,
        purchaseId: inserted[0].id,
      })
      .onConflictDoNothing({ target: starterTrials.organizationId });
  }

  if (addon.creditsGranted > 0 && addon.kind !== "service") {
    await recordCredit(input.organizationId, {
      type: "purchase",
      amount: addon.creditsGranted,
      referenceId: inserted[0].id,
      note: `Bought ${addon.name}`,
    });

    /**
     * The trial buyer gets a different message and a different destination.
     * "1 link credits added" is both ungrammatical and the wrong thing to
     * emphasise — they bought an article, and the next thing they should do is
     * set up the site we will write it for.
     */
    await notify({
      organizationId: input.organizationId,
      type: "addon.purchased",
      title:
        addon.kind === "trial"
          ? "Your Starter article is ready to set up"
          : `${addon.creditsGranted} link credits added`,
      body:
        addon.kind === "trial"
          ? "Add your website and we will write your article and place your backlink."
          : `Your purchase of ${addon.name} is ready to use.`,
      href: addon.kind === "trial" ? "/onboarding" : "/billing",
    });
  } else {
    /**
     * A service we deliver by hand. Nothing is granted automatically, and the
     * notification says so — telling someone their citations are "ready" when
     * a human has not started yet is the kind of promise that produces a
     * refund request.
     */
    await notify({
      organizationId: input.organizationId,
      type: "addon.purchased",
      title: `${addon.name} — payment received`,
      body: "We will start work and email you when it is done.",
      href: "/billing",
    });
  }

  return true;
}
