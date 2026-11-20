import { getFreePlanCounter } from "@/lib/plans/free-plan-server";

import { GrowthPlanPageContent, growthPlanMetadata } from "./growth-plan-page";
import { loadGrowthPlanOffers, signedInAccount } from "./load-offers";

export const metadata = growthPlanMetadata("en");

// One visitor's website per request: never prerendered.
export const dynamic = "force-dynamic";

/** The growth plan (growth-plan-page.tsx); other languages: [locale]/growth-plan. */
export default async function GrowthPlanPage({ searchParams }: PageProps<"/growth-plan">) {
  const [params, offers, freeCounter, account] = await Promise.all([
    searchParams,
    loadGrowthPlanOffers("en"),
    // Optional: a failed read only leaves the counter (and the full-cap check) out.
    getFreePlanCounter().catch(() => null),
    // Signed in already: the flow skips its account step.
    signedInAccount(),
  ]);
  return <GrowthPlanPageContent locale="en" searchParams={params} offers={offers} freeCounter={freeCounter} account={account} />;
}
