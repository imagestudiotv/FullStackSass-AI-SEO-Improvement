import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { GrowthPlanPageContent, growthPlanMetadata } from "@/app/(marketing)/growth-plan/growth-plan-page";

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
  return <GrowthPlanPageContent locale={locale} searchParams={await searchParams} />;
}
