"use server";

import { and, eq } from "drizzle-orm";

import { cleanWebsite } from "@/app/(marketing)/_home/start-field";
import { getSession } from "@/lib/auth-guard";
import { listPlans } from "@/lib/billing";
import { hasUnfinishedPayPalApproval, isTrialEligible, planScreenOffer } from "@/lib/billing/checkouts";
import { growthPlanDashboardPath } from "@/lib/billing/return-to";
import { pendingConversions } from "@/lib/conversions/conversions";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-tables";
import { websites } from "@/lib/db/schema";
import type { BrowserConversion } from "@/lib/google-analytics";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { FREE_TIER } from "@/lib/plans/free-plan";
import { claimReferral } from "@/lib/referrals/actions";
import { requireOrg } from "@/lib/tenant";
import { addWebsite } from "@/lib/websites/actions";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

import { checkoutPlans, type CheckoutPlan } from "./checkout-terms";

/**
 * The growth plan's billing step, on the server (billing-step.tsx): the
 * typed website in the visitor's new (or existing) account, and what the
 * payment buttons need to know about that account.
 *
 * A server action is a public endpoint, so it trusts nothing from the
 * browser but the two strings it is given: who is asking comes from the
 * session (nothing happens without one), the workspace from requireOrg, the
 * website is the caller's own, and the tier must be one on sale. The ids it
 * answers with are then passed to the EXISTING actions - startFreePlanAction,
 * createCheckoutSession, createPayPalCheckout - which check ownership again
 * themselves.
 *
 * THE WEBSITE IS ADDED EXACTLY AS THE ONBOARDING WEBSITE STEP ADDS IT:
 * addWebsite (lib/websites/actions.ts), the same validation, refusals,
 * defaults and analysis job, and nothing more is fetched or crawled here.
 * Called again (a retry, another plan picked), it finds the website already
 * in the workspace and uses it, rather than failing on the duplicate.
 */

/** Longer than any address anyone types; anything beyond is not an address (as actions.ts). */
const MAX_INPUT = 300;

type Account = {
  websiteId: string;
  email: string;
  /** Read from the database, not the session cookie: a code may have been confirmed a moment ago. */
  emailVerified: boolean;
  /** The website already has a plan (paid, Free, or an agency workspace): nothing to buy, setup goes on at `next`. */
  hasPlan: boolean;
  /**
   * Where the visitor goes once the plan is in place: the dashboard for this
   * website (Daniel, 2026-11-21: "once payment is made they are redirect to the
   * dashboard and not on the other steps"). The onboarding steps after the plan
   * are on the Tasks page instead.
   */
  next: string;
  /** The conversions this browser should report now (the sign-up), as the onboarding layout reports them. */
  conversions: BrowserConversion[];
};

export type GrowthPlanBilling =
  | ({ ok: true; kind: "free" } & Account)
  | ({
      ok: true;
      kind: "paid";
      /** Checkout will give the free trial: a workspace that has never subscribed. */
      trialEligible: boolean;
      /** The offer the plan screen states for this workspace (planScreenOffer). */
      offer: "repget" | "winback" | null;
      /** A PayPal payment started and never finished blocks paying another way: the prompt to cancel it. */
      unfinishedPayPal: boolean;
      /** The tier's plans, monthly and yearly, as checkout charges them. */
      plans: CheckoutPlan[];
    } & Account)
  | {
      ok: false;
      /** signed_out: the account step first. plan: no such plan on sale. website: addWebsite refused (its words). */
      reason: "signed_out" | "plan" | "website";
      error: string;
    };

export async function prepareGrowthPlanBilling(rawDomain: string, rawTier: string): Promise<GrowthPlanBilling> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out", error: "Create your account first." };

  const tier = typeof rawTier === "string" ? rawTier : "";
  const free = tier === FREE_TIER;
  // The tier first, so a made-up one never creates a website.
  const rows = free ? [] : await listPlans();
  if (!free && !rows.some((row) => row.tier === tier && row.interval === "month" && row.priceCents > 0)) {
    return { ok: false, reason: "plan", error: "That plan is not available." };
  }

  const domain = typeof rawDomain === "string" && rawDomain.length <= MAX_INPUT ? cleanWebsite(rawDomain) : null;
  if (!domain) return { ok: false, reason: "website", error: "Enter a valid website address" };

  const { orgId, userId } = await requireOrg();
  const website = await websiteFor(orgId, domain);
  if (!website.ok) return { ok: false, reason: "website", error: website.error };
  const websiteId = website.id;

  /*
    A referral left by a /r/CODE visit, attached before any checkout starts,
    as the onboarding layout does (components/referral-claim.tsx): this step
    can reach checkout without ever rendering that layout. Idempotent, and a
    courtesy: a failure never stands in the way.
  */
  await claimReferral().catch(() => {});

  const [[person], state, conversions] = await Promise.all([
    db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1),
    getOnboardingState(orgId, websiteId),
    pendingConversions(db, { userId, userCreatedAt: session.user.createdAt, organizationId: orgId }).catch((): BrowserConversion[] => []),
  ]);
  const account: Account = {
    websiteId,
    email: session.user.email,
    emailVerified: person?.emailVerified === true,
    hasPlan: state.hasPlan,
    next: growthPlanDashboardPath(websiteId),
    conversions,
  };
  if (free) return { ok: true, kind: "free", ...account };

  const [trialEligible, offer, paypalOn, unfinishedPayPal] = await Promise.all([
    isTrialEligible(db, orgId),
    planScreenOffer(db, orgId),
    isPayPalAvailable(),
    hasUnfinishedPayPalApproval(db, { organizationId: orgId, websiteId }),
  ]);
  return {
    ok: true,
    kind: "paid",
    ...account,
    trialEligible,
    offer,
    unfinishedPayPal,
    // REPGET's launch price as the plan step applies it: only while it is the offer on screen.
    plans: checkoutPlans(rows, tier, offer === "repget", paypalOn),
  };
}

/**
 * The workspace's own website for this address, else one added for it by
 * addWebsite, the onboarding website step's action. Matched on the same
 * normalised domain addWebsite's duplicate check uses.
 */
async function websiteFor(orgId: string, domain: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(domain);
  } catch (error) {
    if (error instanceof InvalidUrlError) return { ok: false, error: error.message };
    throw error;
  }
  const [existing] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.organizationId, orgId), eq(websites.domain, normalized.domain)))
    .limit(1);
  if (existing) return { ok: true, id: existing.id };
  const added = await addWebsite(domain);
  return added.ok ? { ok: true, id: added.data.id } : { ok: false, error: added.error };
}
