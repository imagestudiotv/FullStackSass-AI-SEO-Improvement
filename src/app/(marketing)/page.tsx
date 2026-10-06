import type { Metadata } from "next";

import { listPlansForPrebuiltPage } from "@/lib/billing";
import { getMessages } from "@/lib/i18n/messages";
import {
  AuditBand,
  BacklinkNetwork,
  ClosingCta,
  DemoVideo,
  Hero,
  HowItWorks,
  OneSubscription,
  Pillars,
  ProblemSolution,
  ProductPreview,
  Publishing,
  WhatYouSee,
  WorksWith,
} from "./home-sections";
import { PricingPreview } from "./pricing-preview";
import { OrganizationSchema } from "./organization-schema";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

/**
 * Marketing homepage, following the supplied landing design.
 *
 * Renders the same sections as the localised versions, from the same
 * components — see home-sections.tsx. English keeps unprefixed paths, so its
 * href builder returns the path unchanged.
 */

/**
 * Built ahead and refreshed in the background at most hourly, instead of on
 * every visit (client's launch review, 2026-10-03: mobile PageSpeed). Plan
 * prices are the only data here and change rarely; serving a ready-made page
 * from Vercel's edge cuts the server response time PageSpeed weighs heavily.
 * See listPlansForPrebuiltPage for how a build without a database, and a
 * database that fails, are each handled.
 */
export const revalidate = 3600;

/**
 * The homepage's own title, description, canonical and og:url.
 *
 * It had none, so it inherited the root layout's: the title was the bare
 * word "RepGet" and the description an old one-liner - which is what Google
 * showed for the site's most important page. Wording from the client's launch
 * review (2026-10-03).
 *
 * `absolute` because the root layout's template appends "| RepGet" to every
 * title, and this one already ends with it.
 */
export const metadata: Metadata = {
  title: { absolute: "AI SEO Platform for Content & Backlinks | RepGet" },
  description:
    "Automate SEO with RepGet. Research keywords, publish optimized content, build quality backlinks, track rankings and improve visibility in Google and AI search.",
  ...publicPageMetadata("/"),
};

export default async function HomePage() {
  const plans = await listPlansForPrebuiltPage();
  const t = getMessages("en").home;
  // English is unprefixed; the localised pages pass a prefixing builder.
  const href = (path: string) => path;

  /**
   * Matches the metadataBase in the root layout, which falls back to the
   * production domain rather than localhost so a missing variable cannot
   * publish structured data pointing at a developer machine.
   */
  const siteUrl = canonicalSiteUrl();

  return (
    <>
      <OrganizationSchema siteUrl={siteUrl} plans={plans} />
      <Hero t={t} href={href} />
      <ProductPreview t={t} href={href} />
      <Pillars t={t} href={href} />
      <WorksWith t={t} href={href} />
      <DemoVideo t={t} href={href} />
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
