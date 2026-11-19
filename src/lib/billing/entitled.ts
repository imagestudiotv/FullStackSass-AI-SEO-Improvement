import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { isInternalTestingWebsite } from "@/lib/billing/internal-testing";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { FREE_ARTICLES_ONLY, FREE_ARTICLES_ONLY_PAYPAL } from "@/lib/plans/features";
import { FREE_PLAN_LOCKED, FREE_PLAN_PAUSED } from "@/lib/plans/free-plan";
import { freePlanPause } from "@/lib/plans/free-plan-server";
import { checkLimit } from "@/lib/usage";

/**
 * Whether a website may spend money, for use inside a server action.
 *
 * SEPARATE FROM requirePlan(), which redirects and therefore only makes sense
 * in a page. An action returns { ok: false, error } to a form that is already
 * on screen; throwing a redirect from one produces a confusing navigation in
 * the middle of a submit, and callers that catch errors would swallow it.
 *
 * WHY BOTH EXIST: the pages are now gated, but a server action is a public
 * HTTP endpoint. Next gives every action a URL, and anything the browser can
 * invoke, a script can invoke — a cancelled customer whose page redirects can
 * still POST to the action behind it. The page guard stops people wandering
 * in; this stops the spend.
 *
 * Deliberately NOT a limit check. Running out of this month's articles is a
 * different answer with a different message, and usage.ts already handles it
 * where it applies. This asks only the entitlement question: is there a live
 * subscription paying for this website at all.
 *
 * A new account on its free articles (lib/billing/free-articles.ts) is
 * entitled only to what writing them takes - research, the articles, their
 * pictures, publishing - and the website check (client, 2026-10-27: "trials
 * can check the website"), which those paths ask for with
 * `{ freeArticles: true }`. Everything else (AI visibility, backlinks) waits
 * for the plan to start.
 *
 * `{ internalTesting: true }` is the same kind of opt-in: a website listed in
 * INTERNAL_TEST_WEBSITE_IDS, with no subscription, is entitled to what asks for
 * it, which is website audits and social tools (lib/billing/internal-testing.ts).
 *
 * THE FREE PLAN (lib/plans/free-plan.ts) is entitled to what the free
 * articles are - `{ freeArticles: true }`: writing articles, research,
 * pictures, publishing, the website check - and to what asks for it with
 * `{ free: true }` (the AI visibility snapshot, Growth Copilot, social
 * posts), each with its own allowance at its gate. Everything else - backlinks,
 * videos, translations, automatic indexing - needs an upgrade (FREE_PLAN_LOCKED),
 * as does a path that passes `{ free: false }` to opt out explicitly. Locked
 * by default, so a paid path nobody thought about stays paid.
 *
 * And Free spends only while its AI cost protection allows: past the
 * workspace's monthly AI cost cap, or the day's budget for all Free
 * workspaces, every Free spend is refused (FREE_PLAN_PAUSED) - here, where
 * every server action and every job step asks before paying.
 */
export async function isEntitledToSpend(
  websiteId: string,
  options: { freeArticles?: boolean; internalTesting?: boolean; free?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = await checkLimit(websiteId, "keywords");

  if (limit.reason === "no_active_plan") {
    if (options.internalTesting && (await isInternalTestingWebsite(websiteId))) return { ok: true };
    return {
      ok: false,
      error: "Choose a plan for this website first",
    };
  }

  if (limit.reason === "subscription_inactive") {
    return {
      ok: false,
      error: "This website's subscription is not active. Update billing to continue.",
    };
  }

  if (limit.free) {
    const allowed = options.free ?? options.freeArticles ?? false;
    if (!allowed) return { ok: false, error: FREE_PLAN_LOCKED };
    const [site] = await db.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (site && (await freePlanPause(site.organizationId)).paused) return { ok: false, error: FREE_PLAN_PAUSED };
    return { ok: true };
  }

  if (limit.freeArticles && !options.freeArticles) {
    // Through PayPal the plan waits for the customer: say how to start it.
    return { ok: false, error: limit.paypalFreeArticles ? FREE_ARTICLES_ONLY_PAYPAL : FREE_ARTICLES_ONLY };
  }

  return { ok: true };
}


/**
 * The same question for a background job, asked INSIDE the step that spends.
 *
 * Inngest memoises completed steps: a job that checked entitlement in an
 * early step and failed later replays that step's cached "yes" on retry, even
 * if the subscription was cancelled in between. Asking again at the moment of
 * each paid call is the only check a retry cannot skip. Not retried: waiting
 * does not reactivate a cancelled plan.
 */
export async function requireEntitledForSpend(
  websiteId: string,
  options: { freeArticles?: boolean; internalTesting?: boolean; free?: boolean } = {},
): Promise<void> {
  const entitled = await isEntitledToSpend(websiteId, options);
  if (!entitled.ok) {
    throw new NonRetriableError(
      "This website's subscription is not active, so nothing further was spent.",
    );
  }
}
