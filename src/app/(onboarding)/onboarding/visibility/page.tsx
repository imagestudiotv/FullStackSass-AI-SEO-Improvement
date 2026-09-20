import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { geoPrompts, websites } from "@/lib/db/schema";
import { ENGINES, availableEngineIds } from "@/lib/geo/engines";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { VisibilityStep } from "./visibility-step";

export const metadata = { title: "AI visibility" };

export const dynamic = "force-dynamic";

/**
 * Step three: the questions we ask assistants on the customer's behalf.
 *
 * The reference splits a prompt budget across eight assistants. We list the
 * same eight but mark which ones this deployment can actually query — see
 * lib/geo/engines.ts for why offering an engine we cannot reach would be worse
 * than omitting it.
 */
export default async function OnboardingVisibilityPage({
  searchParams,
}: PageProps<"/onboarding/visibility">) {
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
      country: websites.country,
      language: websites.language,
    })
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!site) redirect("/onboarding/website");

  const [prompts, allowance] = await Promise.all([
    db
      .select({
        id: geoPrompts.id,
        prompt: geoPrompts.prompt,
        isSuggested: geoPrompts.isSuggested,
        active: geoPrompts.active,
      })
      .from(geoPrompts)
      .where(eq(geoPrompts.websiteId, site.id))
      .orderBy(geoPrompts.createdAt),
    // 20 on Grow, 50 on Scale — read from the plan paying for THIS site.
    maxPromptsFor(site.id),
  ]);

  const available = availableEngineIds();

  return (
    <div>
      <WizardProgress current="visibility" />
      {/*
        Narrower than the plan step and with no side panel: the design puts
        this step on a single centred column, because the question list is the
        whole screen and a rail beside it would compete with the thing the
        customer is meant to be reading.
      */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <div>
          <VisibilityStep
            websiteId={site.id}
            market={site.country}
            language={site.language}
            initialPrompts={prompts.map((p) => ({ ...p, latest: null }))}
            allowance={allowance}
            engines={ENGINES.map((engine) => ({
              id: engine.id,
              name: engine.name,
              audience: engine.audience,
              available: available.includes(engine.id),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
