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
export default async function OnboardingContentPage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);
  if (!state.websiteId) redirect("/onboarding/website");

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
    checkLimit(orgId, "articles"),
  ]);

  return (
    <div>
      <WizardProgress current="content" />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Articles, content &amp; backlinks
        </h1>
        <p className="mt-2 text-muted-foreground">
          We turn what we learned about{" "}
          {site.brandName ?? site.domain} into a plan you can publish from.
        </p>

        <div className="mt-8">
          <ContentStep
            websiteId={site.id}
            hasKeywords={keywordCount.length > 0}
            hasPlan={plannedCount.length > 0}
            articlesPerMonth={
              articleLimit.limit === UNLIMITED ? null : articleLimit.limit
            }
          />
        </div>
      </div>
    </div>
  );
}
