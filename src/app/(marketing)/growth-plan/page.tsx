import { GrowthPlanPageContent, growthPlanMetadata } from "./growth-plan-page";
import { loadGrowthPlanOffers } from "./load-offers";

export const metadata = growthPlanMetadata("en");

// One visitor's website per request: never prerendered.
export const dynamic = "force-dynamic";

/** The growth plan (growth-plan-page.tsx); other languages: [locale]/growth-plan. */
export default async function GrowthPlanPage({ searchParams }: PageProps<"/growth-plan">) {
  const [params, offers] = await Promise.all([searchParams, loadGrowthPlanOffers("en")]);
  return <GrowthPlanPageContent locale="en" searchParams={params} offers={offers} />;
}
