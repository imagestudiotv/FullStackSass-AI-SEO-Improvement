import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { OnboardingAside } from "@/components/onboarding/onboarding-aside";
import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { competitors, websites } from "@/lib/db/schema";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { SetupStep } from "./setup-step";

export const metadata = { title: "About your business" };

export const dynamic = "force-dynamic";

/**
 * Step two: market and language, business description, competitors — together.
 *
 * The client asked for the reference's steps 2, 3 and 4 merged: "I suggest on
 * step 2, to having this 3 options all in one … instead of redirecting
 * directly to choose a package."
 *
 * NO PLAN GATE HERE, DELIBERATELY. This screen now runs BEFORE billing — the
 * agreed order is website, these three panels, then the plan — so requiring a
 * plan would lock the customer out of the step that comes before buying one.
 * The screens that spend real money (visibility checks, article generation)
 * still gate on `hasPlan`; this one only reads and writes the customer's own
 * description of their own business, which costs nothing.
 */
export default async function OnboardingSetupPage({
  searchParams,
}: PageProps<"/onboarding/setup">) {
  await requireSession();
  const { orgId } = await requireOrg();

  /**
   * Which website this run of setup is about. Without it the state describes
   * the oldest site, which is right for a returning customer and wrong the
   * moment someone adds a second one.
   */
  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const state = await getOnboardingState(orgId, siteParam);
  if (!state.websiteId) redirect("/onboarding/website");

  const [site] = await db
    .select({
      id: websites.id,
      domain: websites.domain,
      brandName: websites.brandName,
      country: websites.country,
      language: websites.language,
      description: websites.description,
      targetAudience: websites.targetAudience,
      status: websites.status,
    })
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!site) redirect("/onboarding/website");

  const rivals = await db
    .select({ domain: competitors.domain, source: competitors.source })
    .from(competitors)
    .where(eq(competitors.websiteId, site.id));

  return (
    <div>
      <WizardProgress current="setup" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14">
          <div>
            <SetupStep
              website={site}
              competitors={rivals}
              analysing={state.analysing}
            />
          </div>

          <OnboardingAside
            title="This is what we will write about"
            note="Your description and audience become the topics we research, plan and publish for you — a fresh article on the schedule your plan pays for."
          >
            {/*
            A preview of the plan these answers produce. The reference shows
            three greyed article rows labelled Week 1-3; ours says the same
            thing without pretending to name articles that have not been
            researched yet.
          */}
            <ul className="space-y-2">
              {["Week 1", "Week 2", "Week 3"].map((week) => (
                <li
                  key={week}
                  className="flex items-center gap-3 rounded-xl border bg-background/80 px-4 py-3 backdrop-blur"
                >
                  <span
                    className="h-2 min-w-0 flex-1 rounded-full bg-muted"
                    aria-hidden="true"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {week}
                  </span>
                </li>
              ))}
            </ul>
          </OnboardingAside>
        </div>
      </div>
    </div>
  );
}
