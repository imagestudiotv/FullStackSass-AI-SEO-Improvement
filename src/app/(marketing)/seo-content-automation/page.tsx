import type { Metadata } from "next";

import { listPlans } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { launchFacts, SEO_CONTENT_AUTOMATION_PATH, seoContentAutomationCopy } from "@/lib/marketing/seo-content-automation";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { SeoContentAutomationContent } from "./seo-content-automation-page";

/** Words that do not depend on the plan row, so the metadata needs no database read. */
const STATIC_COPY = seoContentAutomationCopy(null);

/**
 * /seo-content-automation: the English SEO-content landing page
 * (lib/marketing/seo-content-automation.ts). English only: it is not in
 * TRANSLATED_PATHS or LOCALE_ONLY_PATHS, so it declares no hreflang and
 * /es/seo-content-automation and the rest are 404s.
 *
 * NOT INDEXED and not in PUBLIC_PAGES (so not in the sitemap): it is a paid
 * campaign's destination, prepared before any campaign is approved. Google
 * Ads still reaches a noindex page. Remove `robots` to publish it to search.
 */
export const metadata: Metadata = {
  title: STATIC_COPY.metaTitle,
  description: STATIC_COPY.metaDescription,
  robots: { index: false, follow: true },
  ...publicPageMetadata(SEO_CONTENT_AUTOMATION_PATH),
};

/** Reads the plans table on each request, as /pricing does, so the price shown is the price checkout charges. */
export const dynamic = "force-dynamic";

export default async function SeoContentAutomationPage() {
  const plans = await listPlans();
  return <SeoContentAutomationContent copy={seoContentAutomationCopy(launchFacts(plans, repgetOfferEnabled()))} />;
}
