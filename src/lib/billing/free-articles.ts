import { sql, type AnyColumn, type SQL } from "drizzle-orm";

import type { QuotaRule } from "@/lib/billing/spend-quota";
import { subscriptions } from "@/lib/db/schema";

/**
 * A new account's free articles (client, 2026-10-09: "Create 3 Articles for
 * Free"; the owner chose the terms the same day).
 *
 *  - THE OFFER. A workspace that has never subscribed confirms its email,
 *    picks a plan and adds a card at Stripe; nothing is charged. Its first
 *    FREE_ARTICLES articles are free - the research that plans them, the
 *    writing, their pictures and publishing. Audits, AI visibility, backlinks
 *    and the Partner Network wait for the plan (lib/billing/entitled.ts).
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
 * PayPal starts the plan at once and has no free articles.
 */

/** Free articles written per rolling day across every account. */
export const FREE_ARTICLES_PER_DAY = 100;

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
