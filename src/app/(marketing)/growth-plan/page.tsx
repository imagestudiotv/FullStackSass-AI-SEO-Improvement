import { GrowthPlanPageContent, growthPlanMetadata } from "./growth-plan-page";

export const metadata = growthPlanMetadata("en");

// One visitor's website per request: never prerendered.
export const dynamic = "force-dynamic";

/** The growth plan (growth-plan-page.tsx); other languages: [locale]/growth-plan. */
export default async function GrowthPlanPage({ searchParams }: PageProps<"/growth-plan">) {
  return <GrowthPlanPageContent locale="en" searchParams={await searchParams} />;
}
