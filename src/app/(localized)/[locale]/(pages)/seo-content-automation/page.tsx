import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listPlans } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { isLocale, LOCALE_ONLY_PATHS, type Locale } from "@/lib/i18n/config";
import { launchFacts, SEO_CONTENT_AUTOMATION_PATH, seoContentAutomationCopy } from "@/lib/marketing/seo-content-automation";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { SeoContentAutomationContent } from "@/app/(marketing)/seo-content-automation/seo-content-automation-page";

/**
 * /it|de|es|fr/seo-content-automation: the SEO-content landing page in the
 * four other site languages (lib/marketing/seo-content-automation.translations.ts),
 * the English page's design and facts (app/(marketing)/seo-content-automation).
 * Only the languages in LOCALE_ONLY_PATHS are served; /en/... is the 404 every
 * /en address is.
 *
 * NOT INDEXED and not in the sitemap, like the English page: a paid campaign's
 * destination, prepared before any campaign is approved. Each version is its
 * own canonical, with no hreflang - noindex pages are not alternates of
 * anything - and the html lang its language ([locale]/layout.tsx).
 */
const LOCALES = LOCALE_ONLY_PATHS[SEO_CONTENT_AUTOMATION_PATH] ?? [];

function served(locale: string): locale is Locale {
  return isLocale(locale) && LOCALES.includes(locale);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/seo-content-automation">): Promise<Metadata> {
  const { locale } = await params;
  if (!served(locale)) return {};
  // Words that do not depend on the plan row, so the metadata needs no database read.
  const copy = seoContentAutomationCopy(null, locale);
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { index: false, follow: true },
    ...publicPageMetadata(SEO_CONTENT_AUTOMATION_PATH, { locale }),
  };
}

/** Reads the plans table on each request, as /pricing does, so the price shown is the price checkout charges. */
export const dynamic = "force-dynamic";

export default async function LocalisedSeoContentAutomationPage({ params }: PageProps<"/[locale]/seo-content-automation">) {
  const { locale } = await params;
  if (!served(locale)) notFound();
  const plans = await listPlans();
  return <SeoContentAutomationContent copy={seoContentAutomationCopy(launchFacts(plans, repgetOfferEnabled()), locale)} locale={locale} />;
}
