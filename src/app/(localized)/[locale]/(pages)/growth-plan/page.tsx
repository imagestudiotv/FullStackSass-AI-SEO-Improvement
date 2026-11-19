import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";
import { getFreePlanCounter } from "@/lib/plans/free-plan-server";

import { GrowthPlanPageContent, growthPlanMetadata } from "@/app/(marketing)/growth-plan/growth-plan-page";
import { loadGrowthPlanOffers } from "@/app/(marketing)/growth-plan/load-offers";

// Per request, like the English page: one visitor's website.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/growth-plan">) {
  const { locale } = await params;
  return isLocale(locale) ? growthPlanMetadata(locale) : {};
}

/** The growth plan in Spanish, French, Italian and German. */
export default async function LocalisedGrowthPlanPage({ params, searchParams }: PageProps<"/[locale]/growth-plan">) {
  const { locale } = await params;
  // English lives at /growth-plan.
  if (!isLocale(locale) || locale === "en") notFound();
  const [query, offers, freeCounter] = await Promise.all([
    searchParams,
    loadGrowthPlanOffers(locale),
    // Optional: a failed read only leaves the counter (and the full-cap check) out.
    getFreePlanCounter().catch(() => null),
  ]);
  return <GrowthPlanPageContent locale={locale} searchParams={query} offers={offers} freeCounter={freeCounter} />;
}
