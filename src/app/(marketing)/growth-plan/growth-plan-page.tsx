import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { cleanWebsite, signUpWithWebsite, websiteStep } from "@/app/(marketing)/_home/start-field";
import { PUBLIC_AUDIT_MAX_PAGES } from "@/lib/audit/limits";
import { growthPlanCopy } from "@/lib/i18n/growth-plan";
import { localePath, type Locale } from "@/lib/i18n/config";
import { TRIAL_DAYS } from "@/lib/plans/features";
import { domainParam } from "@/lib/tools/i18n/meta";

import { GrowthPlanFlow } from "./growth-plan-flow";
import type { FreePlanOption, GrowthPlanOffer } from "./plan-offers";

/** One visitor's own plan: never indexed, never in the sitemap. */
export function growthPlanMetadata(locale: Locale): Metadata {
  const t = growthPlanCopy(locale);
  return { title: t.metaTitle, description: t.metaDescription, robots: { index: false, follow: false } };
}

/**
 * The growth plan (client, 2026-11-18, after explee.com's auto funnel): the
 * homepage field sends a website here instead of straight to sign-up. In
 * about a minute the visitor watches RepGet research the business (its own
 * homepage), check its pages (the free audit, lib/audit/public-audit.ts) and
 * turn both into a plan, then starts the trial with the website already
 * filled in (sign-up, then the onboarding website step, as before).
 *
 * Everything shown is read from the visitor's site; no model is called, so
 * an ad click costs nothing but the guarded fetches. Without a usable
 * address there is nothing to plan: back to the homepage.
 *
 * Since 2026-11-19 (Daniel, after explee.com) it ends on the plans
 * themselves (`offers`, read by the page through load-offers.ts) and the way
 * to payment: sign-up, the website step, then the onboarding plan step's
 * Stripe or PayPal checkout with the chosen plan, as from /pricing.
 */
export function GrowthPlanPageContent({
  locale,
  searchParams,
  offers = [],
}: {
  locale: Locale;
  searchParams: Record<string, string | string[] | undefined>;
  offers?: GrowthPlanOffer[];
}) {
  const domain = cleanWebsite(domainParam(searchParams));
  if (!domain) redirect(localePath(locale, "/"));

  const signUp = localePath(locale, "/sign-up");
  const onboarding = localePath(locale, "/onboarding/website");
  /*
    INTEGRATION(free-plan): agent A's Free plan card, in the reader's
    language, from src/lib/plans/free-plan.ts mapped to FreePlanOption
    (plan-offers.ts). Null leaves the paid plans alone.
  */
  const free: FreePlanOption | null = null;
  return (
    <GrowthPlanFlow
      key={domain}
      domain={domain}
      locale={locale}
      copy={growthPlanCopy(locale)}
      maxPages={PUBLIC_AUDIT_MAX_PAGES}
      trialDays={TRIAL_DAYS}
      offers={offers}
      free={free}
      links={{
        signUp: signUpWithWebsite(signUp, onboarding, domain),
        googleNext: websiteStep(onboarding, domain),
        plans: localePath(locale, "/pricing"),
        home: localePath(locale, "/"),
        signUpPath: signUp,
        onboardingPath: onboarding,
      }}
    />
  );
}
