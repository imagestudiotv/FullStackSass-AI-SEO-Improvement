import "server-only";

import { and, count, eq, gte, isNotNull } from "drizzle-orm";

import { isFreeArticlesTrial } from "@/lib/billing/entitlement-period";
import { syncStripeSubscription } from "@/lib/billing/stripe-events";
import { db } from "@/lib/db";
import { articles, subscriptions } from "@/lib/db/schema";
import { FREE_ARTICLES } from "@/lib/plans/features";
import { stripe } from "@/lib/stripe/client";

/*
  Starting the plan once a new account's free articles are written - the
  offer is described in lib/billing/free-articles.ts. Kept apart from it so
  the review gate and the queue can ask "is this website on its free
  articles" without importing Stripe.
*/

/** Free articles WRITTEN since the trial started: deleting one later does not hand it back as a slot (the ledger keeps it). */
async function writtenSince(websiteId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        gte(articles.createdAt, since),
        isNotNull(articles.bodyHtml),
      ),
    );
  return row?.n ?? 0;
}

export type EndTrialOutcome = "ended" | "not_on_free_articles" | "not_yet" | "failed";

/**
 * Starts the plan now if the website's free articles have all been written.
 *
 * Called after each article is written (generate-article.ts) and again when
 * a free article is refused for want of a slot, in case that first call
 * failed. Never throws: an article that was written is not failed by a
 * billing hiccup, and the trial ends by itself when it runs out.
 *
 * Asks Stripe for the subscription first: only a trial still running there
 * is ended, so a repeat (two articles finishing together, a retry) does
 * nothing. The idempotency key makes two simultaneous calls one request.
 */
export async function endFreeTrialIfUsed(websiteId: string): Promise<EndTrialOutcome> {
  try {
    const [sub] = await db
      .select({
        provider: subscriptions.provider,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.websiteId, websiteId), eq(subscriptions.status, "trialing")))
      .limit(1);
    if (!sub || sub.provider !== "stripe" || !sub.stripeSubscriptionId || !isFreeArticlesTrial(sub)) {
      return "not_on_free_articles";
    }
    if ((await writtenSince(websiteId, sub.currentPeriodStart!)) < FREE_ARTICLES) return "not_yet";

    const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    if (live.status === "trialing") {
      await stripe.subscriptions.update(
        sub.stripeSubscriptionId,
        { trial_end: "now" },
        { idempotencyKey: `free-articles-used:${sub.stripeSubscriptionId}` },
      );
    }
    // Recorded now rather than when the webhook lands, so the paid month's allowance is there at once.
    await syncStripeSubscription(sub.stripeSubscriptionId);
    return "ended";
  } catch (error) {
    console.error("[billing] could not start the plan after the free articles", { websiteId, error });
    return "failed";
  }
}
