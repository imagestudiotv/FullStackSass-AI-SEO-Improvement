import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";

import { isEntitled } from "@/lib/billing-shared";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { getSubscription } from "@/lib/billing";
import { isAgencyWorkspace } from "@/lib/agency/core";
import { isFreePlanWebsite } from "@/lib/plans/free-plan-server";

/**
 * Where a new customer is in setting up.
 *
 * Derived from real state on every load rather than stored as a "current step"
 * column. A stored pointer goes wrong the moment someone does something out of
 * order — adds a website from the dashboard, cancels a subscription, deletes
 * their only site — and then the product insists they are somewhere they are
 * not.
 *
 * THE ORDER: add the website, choose a plan. That is all of it (Daniel,
 * 2026-11-24: "delete all this steps and redirect straight to the dashboard").
 * Connecting Google, the AI visibility questions, the content plan and the
 * business profile are on the Tasks page and the launch checklist
 * (lib/tasks/tasks.ts, lib/onboarding/launch.ts), and what those steps used to
 * start - the first content plan, the first questions - starts by itself
 * (lib/keywords/first-plan.ts, lib/geo/first-questions.ts).
 *
 * The `steps` array below is built in order and `currentId` is simply its
 * first unfinished entry, so the sequence is stated once here rather than
 * restated by each screen.
 */

export type OnboardingStepId = "website" | "plan";

export type OnboardingStep = {
  id: OnboardingStepId;
  done: boolean;
  /** Where the step is completed. Null when it is not reachable yet. */
  href: string | null;
};

export type OnboardingState = {
  steps: OnboardingStep[];
  /** The first unfinished step, or null when everything is done. */
  currentId: OnboardingStepId | null;
  complete: boolean;
  /** The website being set up, when one exists. */
  websiteId: string | null;
  /**
   * Whether the workspace is paid for — a live subscription, or an agency
   * workspace, which is ours and needs no plan. The paywall reads it
   * (lib/billing/require-plan.ts).
   */
  hasPlan: boolean;
};

/**
 * Deduplicated per request with React's cache: the dashboard's gate and its
 * checkout wait both read it to decide
 * whether to redirect. Without this the queries below ran twice on every
 * dashboard load.
 */
export const getOnboardingState = cache(async function getOnboardingState(
  orgId: string,
  /**
   * Which website setup is about.
   *
   * Setup is per WEBSITE, not per account: a second site needs its own plan,
   * exactly as the first did. Without this the state always described
   * whichever site the database happened to return first, so adding a second
   * one looked complete the moment it was created.
   *
   * Omitted, it falls back to the OLDEST site, which is the one a returning
   * customer means by "my website". An id from another workspace simply finds
   * nothing — the query is scoped by orgId either way.
   */
  websiteId?: string,
): Promise<OnboardingState> {
  const [subscription, agency, sites] = await Promise.all([
    getSubscription(orgId),
    // An agency workspace is ours rather than sold, so it has no subscription
    // and never needs one. Without this it would sit on "choose a plan"
    // forever, and every later step would stay locked behind it.
    isAgencyWorkspace(orgId),
    db
      .select({
        id: websites.id,
      })
      .from(websites)
      .where(
        websiteId
          ? and(eq(websites.organizationId, orgId), eq(websites.id, websiteId))
          : eq(websites.organizationId, orgId),
      )
      /*
        Oldest first. The query had no ordering at all, so "the website" was
        whichever row Postgres returned — which is stable in practice and
        arbitrary in principle, and would have started changing the moment a
        second site existed.
      */
      .orderBy(asc(websites.createdAt))
      .limit(1),
  ]);

  const site = sites[0] ?? null;

  // The Free plan (lib/plans/free-plan.ts): set up like a paid site, nothing to buy.
  const onFree = site ? await isFreePlanWebsite(site.id) : false;

  const hasPlan = agency || isEntitled(subscription?.status) || onFree;
  const hasWebsite = site !== null;

  const steps: OnboardingStep[] = [
    /**
     * The website comes first now.
     *
     * A plan pays for one website, so there is nothing to buy until a site
     * exists — and adding one is free. The old order deadlocked once billing
     * moved per site: the plan step wanted a website and the website step was
     * disabled until there was a plan.
     */
    {
      id: "website",
      done: hasWebsite,
      href: "/onboarding/website",
    },
    {
      id: "plan",
      done: hasPlan,
      /*
        The onboarding plan screen, not /billing. /billing carries the
        dashboard sidebar, which this flow deliberately hides — the client
        asked for setup to run without it so nobody wanders off mid-purchase.
        /billing remains where an existing customer changes or cancels a plan.
      */
      href: hasWebsite ? "/onboarding/plan" : null,
    },
  ];

  const current = steps.find((step) => !step.done) ?? null;

  return {
    steps,
    currentId: current?.id ?? null,
    complete: current === null,
    websiteId: site?.id ?? null,
    hasPlan,
  };
});
