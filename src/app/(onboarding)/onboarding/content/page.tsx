import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { calendarItems, keywords, websites } from "@/lib/db/schema";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";
import { ContentStep } from "./content-step";

export const metadata = { title: "Content & backlinks" };

export const dynamic = "force-dynamic";

/**
 * Step four: turning the profile into a content plan.
 *
 * The reference promises eight parallel tasks — deep crawl, topic clusters, a
 * 30-day calendar, a 12-month roadmap, cannibalisation report, internal
 * linking map, default author, backlinks — and quotes nine minutes.
 *
 * What is listed here is what our pipeline actually does. The calendar is
 * sized to the plan's monthly article allowance rather than a fixed 30 or 365
 * days, because writing 365 briefs for a plan that publishes five a month
 * would be a year of promises the customer has not bought.
 */
export default async function OnboardingContentPage({
  searchParams,
}: PageProps<"/onboarding/content">) {
  await requireSession();
  const { orgId } = await requireOrg();

  /**
   * Which website this run of setup is about.
   *
   * Setup is per website: a second site needs its own plan, profile check,
   * visibility questions and first article. Without the parameter the state
   * describes the oldest site, which is right for a returning customer and
   * wrong the moment someone adds another one.
   */
  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const state = await getOnboardingState(orgId, siteParam);
  if (!state.websiteId) redirect("/onboarding/website");

  /**
   * Billing is step two, so everything after it needs a plan.
   *
   * Without this the later screens were reachable by typing their URL: the
   * checklist ticked the plan step but nothing enforced it, and these pages
   * only ever checked that a website existed. They also spend real money —
   * analysis, AI visibility checks and article generation all call a model —
   * so an unpaid customer reaching them costs us per visit.
   *
   * /billing rather than /onboarding, because that is where the step actually
   * happens and sending them to a list to click one link is a detour.
   */
  /*
    Carries the website through, so checkout charges the site being set up
    rather than whichever one the switcher last remembered.

    The onboarding plan screen, not /billing: /billing carries the dashboard
    sidebar, and sending someone mid-setup into the full dashboard is exactly
    what this flow is built to avoid.
  */
  if (!state.hasPlan) {
    redirect(
      siteParam ? `/onboarding/plan?site=${siteParam}` : "/onboarding/plan",
    );
  }

  const [site] = await db
    .select({
      id: websites.id,
      brandName: websites.brandName,
      domain: websites.domain,
    })
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!site) redirect("/onboarding/website");

  const [keywordCount, plannedCount, articleLimit] = await Promise.all([
    db
      .select({ n: keywords.id })
      .from(keywords)
      .where(eq(keywords.websiteId, site.id))
      .limit(1),
    db
      .select({ n: calendarItems.id })
      .from(calendarItems)
      .where(eq(calendarItems.websiteId, site.id))
      .limit(1),
    checkLimit(state.websiteId, "articles"),
  ]);

  return (
    <div>
      <WizardProgress current="content" />
      {/*
        The heading now lives inside the step component, beside the state it
        depends on — the design's title and subtitle sit directly above the
        card and change with it.
      */}
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <ContentStep
          websiteId={site.id}
          brandName={site.brandName ?? site.domain}
          hasKeywords={keywordCount.length > 0}
          hasPlan={plannedCount.length > 0}
          articlesPerMonth={
            articleLimit.limit === UNLIMITED ? null : articleLimit.limit
          }
        />
      </div>
    </div>
  );
}
