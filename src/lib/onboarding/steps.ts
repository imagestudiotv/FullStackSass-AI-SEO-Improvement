import { and, asc, count, eq } from "drizzle-orm";
import { cache } from "react";

import { isEntitled } from "@/lib/billing-shared";
import { db } from "@/lib/db";
import { articles, geoPrompts, websites } from "@/lib/db/schema";
import { getSubscription } from "@/lib/billing";
import { isAgencyWorkspace } from "@/lib/agency/core";

/**
 * Where a new customer is in setting up.
 *
 * Derived from real state on every load rather than stored as a "current step"
 * column. A stored pointer goes wrong the moment someone does something out of
 * order — adds a website from the dashboard, cancels a subscription, deletes
 * their only site — and then the product insists they are somewhere they are
 * not.
 *
 * THE ORDER: add the website, tell us about the business (market and language,
 * description, competitors — one screen), choose a plan, then the AI visibility
 * questions and the first article.
 *
 * The plan used to come second. The client moved it after the business
 * questions so someone sees us describe their own business back to them before
 * being asked to pay. The `steps` array below is built in that order and
 * `currentId` is simply its first unfinished entry, so the sequence is stated
 * once here rather than restated by each screen.
 */

export type OnboardingStepId =
  "plan" | "website" | "profile" | "visibility" | "content";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  /** One line on what this step is for, in the customer's terms. */
  description: string;
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
  /** True while analysis is still running, so the UI can wait rather than push on. */
  analysing: boolean;
  /**
   * Whether the workspace is paid for — a live subscription, or an agency
   * workspace, which is ours and needs no plan.
   *
   * Exposed so the steps AFTER billing can refuse to run without one. It was
   * computed here and used only to tick the checklist, which left the later
   * screens reachable by typing their URL.
   */
  hasPlan: boolean;
};

/**
 * Deduplicated per request with React's cache: the sidebar reads this to decide
 * whether to show "Get started", and the dashboard reads it again to decide
 * whether to redirect. Without this the four queries below ran twice on every
 * dashboard load.
 */
export const getOnboardingState = cache(async function getOnboardingState(
  orgId: string,
  /**
   * Which website setup is about.
   *
   * Setup is per WEBSITE, not per account: a second site needs its own plan,
   * its own profile check, its own visibility questions and its own first
   * article, exactly as the first did. Without this the state always described
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
        status: websites.status,
        brandName: websites.brandName,
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

  const [promptCount, articleCount] = site
    ? await Promise.all([
        db
          .select({ n: count() })
          .from(geoPrompts)
          .where(eq(geoPrompts.websiteId, site.id)),
        db
          .select({ n: count() })
          .from(articles)
          .where(eq(articles.websiteId, site.id)),
      ])
    : [[{ n: 0 }], [{ n: 0 }]];

  const hasPlan = agency || isEntitled(subscription?.status);
  const hasWebsite = site !== null;
  /**
   * The profile step is done once analysis has finished, not once the customer
   * has looked at it. Requiring them to click "yes this is right" would block
   * anyone who is happy with what we extracted, which is most people.
   */
  const analysed = site?.status === "ready" || site?.status === "failed";
  const hasPrompts = (promptCount[0]?.n ?? 0) > 0;
  const hasArticles = (articleCount[0]?.n ?? 0) > 0;

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
      title: "Add your website",
      description: "We read it and work out what your business does.",
      done: hasWebsite,
      href: "/onboarding/website",
    },
    /**
     * Market and language, business description, competitors — one screen.
     *
     * Before the plan, not after it. The client asked for the reference's
     * steps 2-4 merged and placed here: "Once we click Continue on the first
     * step. It will automatically provide: Target Market & Language, Business
     * Description, and Competitors", with billing after.
     *
     * Done once analysis has FINISHED, not once the customer has confirmed it.
     * Requiring a click would block everyone who is happy with what we
     * extracted, which is most people.
     */
    {
      id: "profile",
      title: "About your business",
      description:
        "Your market, language, description and competitors. Correct anything we got wrong.",
      done: hasWebsite && analysed,
      href: hasWebsite ? "/onboarding/setup" : null,
    },
    {
      id: "plan",
      title: "Choose a plan",
      description: agency
        ? "This workspace is set up by us — no plan needed."
        : "Each website has its own plan. Start from EUR 1 a month.",
      done: hasPlan,
      /*
        The onboarding plan screen, not /billing. /billing carries the
        dashboard sidebar, which this flow deliberately hides — the client
        asked for setup to run without it so nobody wanders off mid-purchase.
        /billing remains where an existing customer changes or cancels a plan.
      */
      href: hasWebsite ? "/onboarding/plan" : null,
    },
    {
      id: "visibility",
      title: "Add AI visibility questions",
      description:
        "The questions your customers would ask an assistant. We check whether you get named.",
      done: hasPrompts,
      href: hasWebsite && analysed && hasPlan ? "/onboarding/visibility" : null,
    },
    {
      id: "content",
      title: "Write your first article",
      description:
        "We research the terms worth going after and write the page that answers them.",
      done: hasArticles,
      href: hasWebsite && analysed && hasPlan ? "/onboarding/content" : null,
    },
  ];

  const current = steps.find((step) => !step.done) ?? null;

  return {
    steps,
    currentId: current?.id ?? null,
    complete: current === null,
    websiteId: site?.id ?? null,
    // "pending" and "crawling" both mean we are still working on it.
    analysing: hasWebsite && !analysed,
    hasPlan,
  };
});
