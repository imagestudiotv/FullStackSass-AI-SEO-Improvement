import { notFound } from "next/navigation";

import { listPlans } from "@/lib/billing";
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import {
  AuditBand,
  BacklinkNetwork,
  ClosingCta,
  Hero,
  HowItWorks,
  OneSubscription,
  ProblemSolution,
  Publishing,
  WhatYouSee,
} from "../home-sections";
import { PricingPreview } from "../pricing-preview";

/**
 * Localised homepage: /es, /fr, /it, /de.
 *
 * Renders exactly the same sections as the English page, from the same
 * components. This used to be a separate, much simpler page — one section
 * against the English page's nine — which meant switching language visibly
 * downgraded the site. Sharing the components makes that impossible: a section
 * added to the English homepage appears in every language automatically.
 *
 * hreflang tags tell search engines these are the same page in different
 * languages rather than duplicates competing with each other.
 */

// Reads live plan prices, so it cannot be statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);

  return {
    title: t.home.title,
    description: t.home.subtitle,
    alternates: {
      canonical: localePath(locale, "/"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/")]),
      ),
    },
  };
}

export default async function LocalisedHomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale).home;
  const plans = await listPlans();
  // Keeps every in-page link inside the reader's language.
  const href = (path: string) => localePath(locale, path);

  return (
    <>
      <Hero t={t} href={href} />
      <AuditBand t={t} href={href} />
      <HowItWorks t={t} href={href} />
      <ProblemSolution t={t} href={href} />
      <OneSubscription t={t} href={href} />
      <Publishing t={t} href={href} />
      <WhatYouSee t={t} href={href} />
      <BacklinkNetwork t={t} href={href} />
      <PricingPreview t={t} href={href} plans={plans} />
      <ClosingCta t={t} href={href} />
    </>
  );
}
