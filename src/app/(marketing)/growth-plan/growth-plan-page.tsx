import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { cleanWebsite, signUpWithWebsite, websiteStep } from "@/app/(marketing)/_home/start-field";
import { PUBLIC_AUDIT_MAX_PAGES } from "@/lib/audit/limits";
import { growthPlanCopy } from "@/lib/i18n/growth-plan";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { OFFER_CODE, WINBACK_OFFER_CODE } from "@/lib/i18n/offer-code";
import { PAYPAL_PENDING_COPY } from "@/lib/i18n/paypal-pending";
import { TRIAL_DAYS } from "@/lib/plans/features";
import { freePlanDisplay, type FreePlanCounter } from "@/lib/plans/free-plan";
import { domainParam } from "@/lib/tools/i18n/meta";

import type { AccountAuthCopy, SignedInAccount } from "./account-step";
import type { BillingAppCopy } from "./billing-step";
import { readPeriod } from "./flow-steps";
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
 * turn both into a plan.
 *
 * Everything shown is read from the visitor's site; no model is called, so
 * an ad click costs nothing but the guarded fetches. Without a usable
 * address there is nothing to plan: back to the homepage.
 *
 * Since 2026-11-19 (Daniel, after explee.com) it goes on to the plans
 * themselves (`offers`, read by the page through load-offers.ts), and since
 * 2026-11-20 it ends in the page: the account (skipped by someone signed in,
 * `account`) and billing, where Free starts or the existing Stripe / PayPal
 * checkout opens. The plan, the period and ?step=billing in the address are
 * the flow's own return from Google or the sign-in page (flowReturnPath).
 */
export function GrowthPlanPageContent({
  locale,
  searchParams,
  offers = [],
  freeCounter = null,
  account = null,
}: {
  locale: Locale;
  searchParams: Record<string, string | string[] | undefined>;
  offers?: GrowthPlanOffer[];
  /** The Free plan's launch counter (getFreePlanCounter); null when it could not be read. */
  freeCounter?: FreePlanCounter | null;
  /** Who is signed in (page.tsx reads the session), or null. */
  account?: SignedInAccount | null;
}) {
  const domain = cleanWebsite(domainParam(searchParams));
  if (!domain) redirect(localePath(locale, "/"));

  const signUp = localePath(locale, "/sign-up");
  const onboarding = localePath(locale, "/onboarding/website");
  const freeCard = freePlanDisplay(locale, freeCounter);
  const free = freeOption(freeCard);
  const messages = getMessages(locale).app;
  const one = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : null;
  };
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
      freeCard={free ? freeCard : null}
      account={account}
      auth={authCopy(messages.auth)}
      app={appCopy(locale, messages.onboarding)}
      initial={{ tier: one("plan"), period: readPeriod(one("period")), step: one("step") }}
      links={{
        signUp: signUpWithWebsite(signUp, onboarding, domain),
        googleNext: websiteStep(onboarding, domain),
        plans: localePath(locale, "/pricing"),
        home: localePath(locale, "/"),
        signUpPath: signUp,
        onboardingPath: onboarding,
        growthPlanPath: localePath(locale, "/growth-plan"),
        signInPath: localePath(locale, "/sign-in"),
      }}
    />
  );
}

/**
 * The Free plan's card for the plans step, in the reader's language (the
 * same display data as /pricing's Free card). Left out once the launch cap
 * is reached: the paid plans' free trial is the offer then.
 */
function freeOption(display: ReturnType<typeof freePlanDisplay>): FreePlanOption | null {
  if (display.counter?.full) return null;
  return {
    tier: display.tier,
    name: display.name,
    description: display.desc,
    badge: display.badge,
    price: display.price,
    priceNote: display.caption,
    features: display.features,
    cta: display.cta,
  };
}

/** Only the sign-up form's lines the account step says: the browser gets these, not the whole dictionary. */
function authCopy(auth: ReturnType<typeof getMessages>["app"]["auth"]): AccountAuthCopy {
  return {
    continueWithGoogle: auth.continueWithGoogle,
    orContinueWithEmail: auth.orContinueWithEmail,
    fullName: auth.fullName,
    namePlaceholder: auth.namePlaceholder,
    email: auth.email,
    emailPlaceholder: auth.emailPlaceholder,
    password: auth.password,
    passwordHint: auth.passwordHint,
    passwordPlaceholder: auth.passwordPlaceholder,
    showPassword: auth.showPassword,
    hidePassword: auth.hidePassword,
    tooManyAttempts: auth.tooManyAttempts,
    passwordTooLong: auth.passwordTooLong,
    createAccount: auth.createAccount,
    creatingAccount: auth.creatingAccount,
    legal: auth.legal,
    terms: auth.terms,
    privacy: auth.privacy,
    haveAccount: auth.haveAccount,
    signIn: auth.signIn,
    connectionFailed: auth.connectionFailed,
  };
}

/** The plan step's lines the billing step repeats, in the reader's language. */
function appCopy(locale: Locale, onboarding: ReturnType<typeof getMessages>["app"]["onboarding"]): BillingAppCopy {
  return {
    paypalNoTrial: onboarding.paypalNoTrial,
    paypalFreeArticles: onboarding.paypalFreeArticles,
    cancelAnyTime: onboarding.cancelAnyTime,
    paypalPending: PAYPAL_PENDING_COPY[locale],
    offer: { repget: OFFER_CODE[locale], winback: WINBACK_OFFER_CODE[locale] },
  };
}
