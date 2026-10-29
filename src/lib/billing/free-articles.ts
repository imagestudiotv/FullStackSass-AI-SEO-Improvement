import { sql, type AnyColumn, type SQL } from "drizzle-orm";

import type { QuotaRule } from "@/lib/billing/spend-quota";
import { subscriptions } from "@/lib/db/schema";
import { FREE_ARTICLES } from "@/lib/plans/features";

/**
 * A new account's free articles (client, 2026-10-09: "Create 3 Articles for
 * Free"; the owner chose the terms the same day).
 *
 *  - THE OFFER. A workspace that has never subscribed confirms its email,
 *    picks a plan and adds a card at Stripe; nothing is charged. Its first
 *    FREE_ARTICLES articles are free - the research that plans them, the
 *    writing, their pictures and publishing. The website check is open too,
 *    and the first TRIAL_CREDIT_DAYS days bring daily credits (client,
 *    2026-10-27; lib/credits/daily.ts). AI visibility, backlinks and the
 *    Partner Network wait for the plan (lib/billing/entitled.ts).
 *  - THE MECHANISM. A Stripe trial of FREE_ARTICLES_DAYS
 *    (lib/billing/checkouts.ts). While it runs, the website's article
 *    allowance is FREE_ARTICLES (usage.ts), counted from the trial's start.
 *  - THE PLAN STARTS after the last free article is written (lib/billing/
 *    end-free-trial.ts ends the trial then), or when the trial runs out if
 *    they were not all used. Cancelling before then costs nothing. The paid
 *    month starts with its full allowance.
 *  - ABUSE. One trial per workspace, ever (isTrialEligible); a confirmed
 *    address and a card to get one; and at most FREE_ARTICLES_PER_DAY free
 *    articles a day across all accounts, so a wave of sign-ups cannot run up
 *    the writing bill.
 *
 * PAYPAL (2026-10-22, "as same as the case of Stripe"): the same offer, on
 * the plan's free-articles PayPal plan - FREE_ARTICLES_DAYS free, then the
 * price (scripts/paypal-plans.mjs, plans.paypal_trial_plan_id). Its free
 * days are recorded as "trialing" (lib/billing/paypal-events.ts), so
 * everything here applies unchanged. One difference: PayPal cannot cut free
 * days short, so the plan does not start by itself after the last free
 * article. The customer is told (end-free-trial.ts) and starts it with
 * "Start your plan now" on Billing - a new PayPal subscription, charged at
 * once, that takes over from the free one and has it cancelled
 * (lib/billing/subscription-sync.ts, "replaced_free_articles"). Otherwise
 * PayPal's first charge starts it when the free days end.
 */

/** Free articles written per rolling day across every account. */
export const FREE_ARTICLES_PER_DAY = 100;

/** Stored dates read the same for every reader of these English lines. */
const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Why a new article is refused once the free articles are used up
 * (generate-article.ts). By card the plan starts by itself straight after
 * the last one; through PayPal it waits for the customer (payPalPlanWaits).
 */
export function freeArticlesUsedMessage(paypal?: { startsOn: Date | null }): string {
  return paypal
    ? `Your ${FREE_ARTICLES} free articles have been used. ${payPalPlanWaits(paypal.startsOn)}`
    : `Your ${FREE_ARTICLES} free articles have been used. Your plan starts once the last of them is written, and then you can write more.`;
}

/** Through PayPal, what starts the plan once the free articles are written: the customer, or the end of the free days. */
export function payPalPlanWaits(startsOn: Date | null): string {
  const when = startsOn ? `on ${LONG_DATE.format(startsOn)}` : "when its free days end";
  return `To write more now, start your plan in Billing - otherwise PayPal starts it ${when}.`;
}

/** The site-wide day's free articles, reserved with each one (generate-article.ts). */
export function freeArticlesDailyRule(): QuotaRule {
  return { key: "free-articles:global", limit: FREE_ARTICLES_PER_DAY, window: { seconds: 24 * 60 * 60 } };
}

/**
 * True while the website in `websiteId` is on its free articles, as SQL for
 * queries over many websites - isFreeArticlesTrial's rule (trialing, with a
 * trial longer than a week).
 */
export function onFreeArticles(websiteId: AnyColumn | SQL | string): SQL {
  return sql`exists (
    select 1 from ${subscriptions} fa
    where fa.website_id = ${websiteId}
      and fa.status = 'trialing'
      and fa.current_period_end - fa.current_period_start > interval '7 days'
  )`;
}
