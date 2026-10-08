import type { PlanRow } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { HomeFaq } from "./home-faq";
import {
  AuditBand,
  BacklinkNetwork,
  ClosingCta,
  ContentEngine,
  DemoVideo,
  Hero,
  HowItWorks,
  Pillars,
  ProblemSolution,
  ProductPreview,
  WhatYouSee,
} from "./home-sections";
import { PricingPreview } from "./pricing-preview";
import { Testimonials } from "./testimonials-section";

/**
 * The homepage's sections, in order - ONE list for every language.
 *
 * The English page and the localised ones used to compose the sections
 * separately, and two lists of the same fourteen sections are two places to
 * forget a change. Both now render this, so a section moved here moves in
 * every language.
 *
 * The order is the client's reference design (2026-10-07): the promise, the
 * two-minute walkthrough straight after it, then the free check it leads
 * into, how it works, the problem it solves, what it writes, what you see,
 * the backlink network, the dashboard, what people say (only when there are
 * approved quotes), pricing, questions, and the closing call.
 */
export function HomePageSections({
  locale,
  href,
  plans,
}: {
  locale: Locale;
  /** Builds locale-aware paths: unchanged on English, prefixed elsewhere. */
  href: (path: string) => string;
  plans: PlanRow[];
}) {
  const messages = getMessages(locale);
  const t = messages.home;

  return (
    <>
      <Hero t={t} href={href} />
      <DemoVideo t={t} href={href} lang={locale} />
      <AuditBand t={t} href={href} intro />
      <HowItWorks t={t} href={href} />
      <ProblemSolution t={t} href={href} />
      <Pillars t={t} href={href} />
      <ContentEngine t={t} href={href} />
      <WhatYouSee t={t} href={href} />
      <BacklinkNetwork t={t} href={href} />
      <ProductPreview t={t} href={href} />
      <Testimonials t={t} />
      <PricingPreview t={t} href={href} plans={plans} />
      <HomeFaq t={t} faq={messages.faq} href={href} />
      <ClosingCta t={t} href={href} />
    </>
  );
}
