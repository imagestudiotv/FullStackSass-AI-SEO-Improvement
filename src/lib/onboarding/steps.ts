import { count, eq } from "drizzle-orm";

import { isEntitled } from "@/lib/billing-shared";
import { db } from "@/lib/db";
import { articles, geoPrompts, websites } from "@/lib/db/schema";
import { getSubscription } from "@/lib/billing";

/**
 * Where a new customer is in setting up.
 *
 * Derived from real state on every load rather than stored as a "current step"
 * column. A stored pointer goes wrong the moment someone does something out of
 * order — adds a website from the dashboard, cancels a subscription, deletes
 * their only site — and then the product insists they are somewhere they are
 * not.
 *
 * The order matches the brief: choose a plan, add the website, check what we
 * worked out about it, then the AI visibility questions and content.
 */

export type OnboardingStepId =
  | "plan"
  | "website"
  | "profile"
  | "visibility"
  | "content";

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
};

export async function getOnboardingState(
  orgId: string,
): Promise<OnboardingState> {
  const [subscription, sites] = await Promise.all([
    getSubscription(orgId),
    db
      .select({
        id: websites.id,
        status: websites.status,
        brandName: websites.brandName,
      })
      .from(websites)
      .where(eq(websites.organizationId, orgId))
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

  const hasPlan = isEntitled(subscription?.status);
  const hasWebsite = site !== null;
  /**
   * The profile step is done once analysis has finished, not once the customer
   * has looked at it. Requiring them to click "yes this is right" would block
   * anyone who is happy with what we extracted, which is most people.
   */
  const analysed = site?.status === "ready" || site?.status === "failed";
  const hasPrompts = (promptCount[0]?.n ?? 0) > 0;
  const hasArticles = (articleCount[0]?.n ?? 0) > 0;

  const websiteHref = site ? `/websites/${site.id}` : null;

  const steps: OnboardingStep[] = [
    {
      id: "plan",
      title: "Choose a plan",
      description: "Start from EUR 1 a month. Cancel any time.",
      done: hasPlan,
      href: "/billing",
    },
    {
      id: "website",
      title: "Add your website",
      description: "We read it and work out what your business does.",
      done: hasWebsite,
      // Not reachable until there is a plan: adding a website without one
      // fails the limit check with a billing error, which reads as a bug.
      href: hasPlan ? "/websites" : null,
    },
    {
      id: "profile",
      title: "Check what we found",
      description:
        "Your brand, industry, market and services. Correct anything we got wrong.",
      done: hasWebsite && analysed,
      href: hasWebsite ? websiteHref : null,
    },
    {
      id: "visibility",
      title: "Add AI visibility questions",
      description:
        "The questions your customers would ask an assistant. We check whether you get named.",
      done: hasPrompts,
      href: hasWebsite && analysed ? websiteHref : null,
    },
    {
      id: "content",
      title: "Write your first article",
      description:
        "We research the terms worth going after and write the page that answers them.",
      done: hasArticles,
      href: hasWebsite && analysed ? websiteHref : null,
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
  };
}
