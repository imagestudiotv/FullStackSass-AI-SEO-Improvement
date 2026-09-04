import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { geoPrompts, websites } from "@/lib/db/schema";
import { ENGINES, availableEngineIds } from "@/lib/geo/engines";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
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
export default async function OnboardingVisibilityPage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);
  if (!state.websiteId) redirect("/onboarding/website");

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

  const prompts = await db
    .select({
      id: geoPrompts.id,
      prompt: geoPrompts.prompt,
      isSuggested: geoPrompts.isSuggested,
    })
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id));

  const available = availableEngineIds();

  return (
    <div>
      <WizardProgress current="visibility" />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          AI visibility — tracking prompts
        </h1>
        <p className="mt-2 text-muted-foreground">
          The questions your customers would ask an assistant before they know
          you exist. We ask them on a schedule and record whether you get named.
        </p>

        <div className="mt-8">
          <VisibilityStep
            websiteId={site.id}
            market={site.country}
            language={site.language}
            initialPrompts={prompts}
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
