import { notFound } from "next/navigation";

import { listPlans } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { isLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { listPublishedTestimonials } from "@/lib/marketing/testimonials-db";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { PricingView } from "../../pricing/pricing-view";

/**
 * Localised pricing: the English page's design (pricing/pricing-view.tsx) in
 * the reader's language.
 *
 * Prices come from the same plans table as the English page, so a price change
 * is made once and cannot drift between languages. Only the surrounding copy is
 * translated - the numbers are the numbers, and the plan NAMES stay in English
 * because they are product names: "Launch" is what the customer sees on their
 * invoice.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);

  return {
    title: t.pricing.title,
    description: t.pricing.metaDescription,
    ...publicPageMetadata("/pricing", { locale }),
  };
}

export default async function LocalisedPricingPage({
  params,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const [plans, testimonials] = await Promise.all([listPlans(), listPublishedTestimonials()]);
  return <PricingView locale={locale} plans={plans} testimonials={testimonials} offer={repgetOfferEnabled()} />;
}
