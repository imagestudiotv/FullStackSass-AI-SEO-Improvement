import { listPlans } from "@/lib/billing";
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
} from "./home-sections";
import { PricingPreview } from "./pricing-preview";
import { OrganizationSchema } from "./organization-schema";

/**
 * Marketing homepage, following the supplied landing design.
 *
 * Renders the same sections as the localised versions, from the same
 * components — see home-sections.tsx. English keeps unprefixed paths, so its
 * href builder returns the path unchanged.
 */

// Reads live plan prices, so it cannot be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPlans();
  const t = getMessages("en").home;
  // English is unprefixed; the localised pages pass a prefixing builder.
  const href = (path: string) => path;

  /**
   * Matches the metadataBase in the root layout, which falls back to the
   * production domain rather than localhost so a missing variable cannot
   * publish structured data pointing at a developer machine.
   */
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
      : "https://seovision.io";

  return (
    <>
      <OrganizationSchema siteUrl={siteUrl} />
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
