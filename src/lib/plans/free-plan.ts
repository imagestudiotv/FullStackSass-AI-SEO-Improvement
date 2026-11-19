import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { freePlanCopy, type FreePlanCopy } from "@/lib/i18n/free-plan";
import { TRIAL_DAYS } from "@/lib/plans/features";

/**
 * The Free Forever plan (Daniel, 2026-11-19): "a free RepGet plan without a
 * credit card ... let free users discover the value, then charge when they
 * want to grow consistently". It REPLACES Launch on every sale surface
 * ("We will replace it with our basic Launch plan, we don't need it").
 *
 * DEFINED IN CODE, NOT AS A PLAN ROW. Free has no price at Stripe or PayPal
 * and nothing is ever charged for it, so it needs none of what a plans row is
 * for (a price id, a catalog version, a subscription). A Free website is the
 * one recorded in free_plan_accounts (lib/plans/free-plan-server.ts), and its
 * allowances are FREE_PLAN below, read by lib/usage.ts where a paid plan's
 * come from its row. A website that pays has a subscription, which always
 * wins: upgrading needs no clean-up, and the Free row stays as history for
 * the launch dashboard.
 *
 * Launch is not deleted: its rows keep is_active and every Launch subscriber
 * keeps their row, limits, price and billing (docs/plan-catalog.md, "a
 * catalog is never repriced"). It is only taken off sale here
 * (RETIRED_FROM_SALE_TIERS), in code, so nothing in Stripe, PayPal or the
 * production plans table changes.
 *
 * This file is PURE (no database, no server-only import): the pricing card,
 * the homepage, the onboarding plan step and the growth-plan flow's billing
 * step all render freePlanDisplay in the browser bundle.
 */

/** The tier string the sale surfaces and the sign-up links use for Free. */
export const FREE_TIER = "free";

/**
 * What Free includes (the card, free-plan-card.png). Every surface and every
 * check reads these numbers, so the card cannot promise what the allowance
 * does not give.
 *
 * - articlesPerMonth / socialPostsPerMonth / auditsPerMonth /
 *   visibilitySnapshotsPerMonth: per UTC calendar month.
 * - searchTerms: kept topics, like a paid plan's keyword limit (not used up).
 * - copilotPerDay: free Growth Copilot messages per UTC day (paid plans:
 *   lib/chat/config.ts CHAT_FREE_PER_DAY).
 * - visibilityQuestions: the questions one snapshot asks (a paid plan tracks
 *   20 or 50, lib/geo/shared.ts): each is two model calls.
 * - auditPages: the "limited" SEO audit - the same audit, over at most this
 *   many pages of the site (a paid audit reads the whole sitemap).
 * - socialPostsPerMonth is paid the way every plan pays posts: in credits
 *   (scripts/plan-catalog.mjs, "SOCIAL POSTS ARE NOT A SECOND METER"). Free
 *   is granted this many credits each month (lib/plans/free-plan-server.ts
 *   grantFreePlanCredits), at the client's 1 credit a post.
 */
export const FREE_PLAN = {
  articlesPerMonth: 4,
  socialPostsPerMonth: 8,
  searchTerms: 10,
  websites: 1,
  auditsPerMonth: 1,
  auditPages: 10,
  visibilitySnapshotsPerMonth: 1,
  visibilityQuestions: 5,
  copilotPerDay: 3,
} as const;

/** The launch cap when no administrator has set one (Admin -> Free plan launch; env FREE_PLAN_CAP). */
export const FREE_PLAN_DEFAULT_CAP = 500;

/** The observation window from the first Free account (Daniel: "an initial 30-day observation period"). */
export const FREE_PLAN_OBSERVATION_DAYS = 30;

/**
 * Tiers no longer SOLD, though their subscribers keep them: left out of every
 * plan list a customer chooses from (lib/billing.ts listPlans) and refused
 * as a new purchase at checkout (isTierOnSale). Launch, replaced by Free.
 */
export const RETIRED_FROM_SALE_TIERS: readonly string[] = ["launch"];

export function isRetiredFromSale(tier: string | null | undefined): boolean {
  return Boolean(tier) && RETIRED_FROM_SALE_TIERS.includes(tier as string);
}

/** The launch counter: Free accounts started against the cap. */
export type FreePlanCounter = {
  taken: number;
  cap: number;
  /** The cap is reached: new sign-ups get the paid plans' free trial instead. */
  full: boolean;
  /** 0-100, for the progress bar. */
  percent: number;
};

export function freePlanCounter(taken: number, cap: number): FreePlanCounter {
  const safeCap = Math.max(0, Math.floor(cap));
  const safeTaken = Math.max(0, Math.floor(taken));
  return {
    taken: Math.min(safeTaken, safeCap),
    cap: safeCap,
    full: safeTaken >= safeCap,
    percent: safeCap === 0 ? 100 : Math.min(100, Math.round((safeTaken / safeCap) * 100)),
  };
}

/** The values the copy's `{placeholders}` are filled with. */
export function freePlanValues(locale: Locale = "en") {
  const number = (n: number) => n.toLocaleString(locale === "en" ? "en-IE" : locale);
  return {
    articles: FREE_PLAN.articlesPerMonth,
    posts: FREE_PLAN.socialPostsPerMonth,
    terms: number(FREE_PLAN.searchTerms),
    copilot: FREE_PLAN.copilotPerDay,
    days: TRIAL_DAYS,
  };
}

/**
 * Sign-up for Free: through the website step to the plan step with Free
 * chosen (lib/plans/features.ts signUpForPlan), where it starts with one
 * click and no card. When the cap is reached the card links to Grow's free
 * trial instead.
 */
export function freePlanHref(full = false): string {
  const tier = full ? "grow" : FREE_TIER;
  return `/sign-up?next=${encodeURIComponent(`/onboarding/website?plan=${tier}`)}`;
}

/** The in-app lines (lib/i18n/free-plan.ts `app`) a server can return. */
export type FreePlanMessageKey = Exclude<keyof FreePlanCopy["app"], "indicator" | "indicatorNone">;

/**
 * One in-app line, filled in. Servers return the English one (as every
 * refusal in this codebase is English on the wire) and the screen showing
 * it swaps it for the reader's language with localiseFreePlanMessage.
 */
export function freePlanMessage(key: FreePlanMessageKey, locale: Locale = "en"): string {
  return format(freePlanCopy(locale).app[key], freePlanValues(locale));
}

/** A paid feature refused on Free (lib/billing/entitled.ts). */
export const FREE_PLAN_LOCKED = freePlanMessage("upgradeTitle");
/** Free AI generation paused by the cost protection (lib/plans/free-plan-server.ts freePlanPause). */
export const FREE_PLAN_PAUSED = freePlanMessage("paused");

/** A server's English Free line in the reader's language; any other text unchanged. */
export function localiseFreePlanMessage(message: string, locale: Locale): string {
  if (locale === "en") return message;
  const keys = Object.keys(freePlanCopy("en").app) as (keyof FreePlanCopy["app"])[];
  for (const key of keys) {
    if (key === "indicator" || key === "indicatorNone") continue;
    if (freePlanMessage(key, "en") === message) return freePlanMessage(key, locale);
  }
  return message;
}

/**
 * Everything a surface needs to draw the Free card, in the reader's
 * language: the pricing page, the homepage, the onboarding plan step and the
 * growth-plan flow's last step (agent C's stepper) render this, so the card
 * reads the same everywhere. `**words**` in features/locked are bold.
 *
 * `counter` is the launch counter (lib/plans/free-plan-server.ts
 * getFreePlanCounter), or null to leave the counter out. When it is full the
 * CTA becomes the paid plans' free trial and `ctaHref` goes to Grow.
 */
export type FreePlanDisplay = {
  tier: typeof FREE_TIER;
  name: string;
  priceCents: 0;
  currency: "eur";
  /** "€0" */
  price: string;
  desc: string;
  badge: string;
  perMonth: string;
  caption: string;
  cta: string;
  ctaLabel: string;
  ctaHref: string;
  includedLabel: string;
  features: string[];
  locked: string[];
  more: string;
  counter: (FreePlanCounter & { text: string; label: string }) | null;
  /** Set when the cap is reached: the line under the counter. */
  fullNote: string | null;
  limits: typeof FREE_PLAN;
};

export function freePlanDisplay(locale: Locale = "en", counter: FreePlanCounter | null = null): FreePlanDisplay {
  const t = freePlanCopy(locale).card;
  const values = freePlanValues(locale);
  const full = counter?.full ?? false;
  const fill = (text: string) => format(text, { ...values, taken: counter?.taken ?? 0, cap: counter?.cap ?? FREE_PLAN_DEFAULT_CAP });
  return {
    tier: FREE_TIER,
    name: t.name,
    priceCents: 0,
    currency: "eur",
    price: "€0",
    desc: t.desc,
    badge: t.badge,
    perMonth: t.perMonth,
    caption: t.caption,
    cta: full ? fill(t.fullCta) : t.cta,
    ctaLabel: full ? fill(t.fullCta) : t.ctaLabel,
    ctaHref: freePlanHref(full),
    includedLabel: t.includedLabel,
    features: t.features.map(fill),
    locked: t.locked.map(fill),
    more: t.more,
    counter: counter
      ? { ...counter, text: full ? fill(t.full) : fill(t.counter), label: full ? fill(t.full) : fill(t.counterLabel) }
      : null,
    fullNote: full ? fill(t.fullNote) : null,
    limits: FREE_PLAN,
  };
}
