import type { StatusTone } from "@/components/ui/status-badge";
import { isEntitled, type CurrentSubscription, type PlanRow } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber, intlTag, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

/**
 * What the billing page shows, decided from data it already has.
 *
 * Pure and client-safe (no database, no provider SDK), so the page and its
 * tests share one statement of the rules. Nothing here changes a price, an
 * amount, a credit or an entitlement: it decides wording and which of the
 * EXISTING buttons can work for the website on screen. Every action still
 * re-checks on the server (createCheckoutSession, createPayPalCheckout,
 * createPortalSession), which remains the authority.
 */

type BillingCopy = Messages["app"]["billing"];

/**
 * Money in the reader's convention: "€99" in English, "99 €" in German.
 *
 * The same amount and the same rounding as formatPrice in lib/billing-shared
 * (whole units when the price is whole, otherwise two decimals) - only the
 * symbol position and separators follow the account's language. formatPrice
 * itself stays as it is: marketing, onboarding and admin use it.
 */
export function formatMoney(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlTag(locale), {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/* ------------------------------------------------------------------------- */
/* Subscription status                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Stored subscription statuses (Stripe's vocabulary; PayPal's are mapped onto
 * it in lib/paypal/subscriptions.ts) plus "inactive". "inactive" is what the
 * website list reports for a website with no subscription row, AND what a
 * real row stores when an operator deactivates the workspace (Stripe keeps
 * billing) or PayPal reports a state mapStatus does not know.
 *
 * `badge` is the StatusBadge key whose ICON carries the meaning (a check, a
 * warning triangle, a cross, a pause), so the status never rests on colour.
 * The words come from the billing dictionary: the shared status vocabulary
 * knows only active/inactive/cancelled, which left "past_due" and "trialing"
 * in English in every language.
 *
 * past_due stays a WARNING, never softened to "Active": a payment failed and
 * the customer has to act, which is the one state this page most needs to say.
 */
const SUBSCRIPTION_STATUS: Record<string, { label: keyof BillingCopy; tone: StatusTone; badge: string }> = {
  active: { label: "statusActive", tone: "positive", badge: "active" },
  trialing: { label: "statusTrialing", tone: "positive", badge: "active" },
  past_due: { label: "statusPastDue", tone: "warning", badge: "missing" },
  unpaid: { label: "statusUnpaid", tone: "critical", badge: "failed" },
  incomplete: { label: "statusIncomplete", tone: "warning", badge: "missing" },
  incomplete_expired: { label: "statusIncompleteExpired", tone: "neutral", badge: "cancelled" },
  canceled: { label: "statusCanceled", tone: "neutral", badge: "cancelled" },
  paused: { label: "statusPaused", tone: "neutral", badge: "inactive" },
  inactive: { label: "statusInactive", tone: "neutral", badge: "inactive" },
};

export type SubscriptionStatusView = { label: string; tone: StatusTone; badge: string };

export function subscriptionStatus(status: string, t: BillingCopy): SubscriptionStatusView {
  const known = SUBSCRIPTION_STATUS[status];
  if (known) return { label: t[known.label], tone: known.tone, badge: known.badge };
  // A value nothing here knows: shown as a plain word, not hidden.
  const words = status.replace(/[_-]+/g, " ").trim();
  return { label: words.charAt(0).toUpperCase() + words.slice(1), tone: "neutral", badge: status };
}

/* ------------------------------------------------------------------------- */
/* Which of the existing buttons can work                                     */
/* ------------------------------------------------------------------------- */

/** Statuses at which a subscription can never bill again (mirrors ENDED in lib/billing/checkouts.ts). */
const ENDED = new Set(["canceled", "incomplete_expired"]);

export type BillingProvider = "stripe" | "paypal";

export type PaymentOptions = {
  /**
   * The processor this website pays through right now, when it has a live
   * subscription there. beginCheckout refuses the OTHER processor for such a
   * site ("This website is already billed by …"), so that processor's
   * buttons are not offered.
   */
  billedBy: BillingProvider | null;
  /**
   * A live subscription that is neither entitled nor winding down (unpaid,
   * incomplete, paused): beginCheckout refuses every new checkout until it
   * is settled or cancelled.
   */
  unsettled: boolean;
  /** "Pay by card" / "Switch to this plan" can start. */
  card: boolean;
  /** "Pay with PayPal" can start (PayPal configured and not refused). */
  paypal: boolean;
  /** The Stripe portal home ("Manage billing") applies to this website. */
  manageInStripe: boolean;
  /** Stripe's cancellation flow applies: a live card subscription not already ending. */
  cancelInStripe: boolean;
  /** The website pays through PayPal: receipts and cancellation live there. */
  manageInPayPal: boolean;
  /** Entitled with no processor route: point at support rather than say nothing. */
  managedForYou: boolean;
};

/**
 * The buttons that can work for this website's subscription.
 *
 * Read from the selected website's own row (provider, status,
 * cancelAtPeriodEnd) and the workspace's Stripe customer. hasCustomer is
 * WORKSPACE-wide, so it alone used to put "Cancel subscription" and "Manage
 * billing" on a PayPal-billed site, where the cancel then failed with "This
 * website has no card subscription to cancel".
 *
 * A Stripe subscription cannot exist without a Stripe customer, so a "stripe"
 * row in a workspace with no customer is one granted by hand: no processor
 * holds it, and either processor may be used to start paying.
 */
export function paymentOptions(
  subscription: CurrentSubscription | null,
  paypalAvailable: boolean,
): PaymentOptions {
  const provider: BillingProvider = subscription?.provider === "paypal" ? "paypal" : "stripe";
  /*
    "inactive" counts as live, as it does in beginCheckout: the page passes
    null for a website with no subscription row, so an "inactive" here is a
    real row a processor may still be charging (an operator's deactivation
    leaves Stripe billing). It is unsettled, so checkouts stay closed, and a
    card row keeps its Cancel, which the portal honours at any status.
  */
  const live = subscription !== null && !ENDED.has(subscription.status);
  const billedBy: BillingProvider | null = !live
    ? null
    : provider === "paypal"
      ? "paypal"
      : subscription?.hasCustomer
        ? "stripe"
        : null;
  const unsettled =
    billedBy !== null && !isEntitled(subscription?.status) && !subscription?.cancelAtPeriodEnd;

  const manageInPayPal = subscription !== null && provider === "paypal";
  const manageInStripe = subscription !== null && !manageInPayPal && subscription.hasCustomer;

  return {
    billedBy,
    unsettled,
    card: !unsettled && billedBy !== "paypal",
    paypal: paypalAvailable && !unsettled && billedBy !== "stripe",
    manageInStripe,
    cancelInStripe: manageInStripe && billedBy === "stripe" && !subscription?.cancelAtPeriodEnd,
    manageInPayPal,
    managedForYou:
      subscription !== null && !manageInStripe && !manageInPayPal && isEntitled(subscription.status),
  };
}

/**
 * Where a card payment's invoice is found when the webhook left no link:
 * Stripe's portal, behind "Manage billing".
 *  - "page": the plan section already has the button (paymentOptions'
 *    manageInStripe).
 *  - "here": it does not (the website on screen has no card subscription),
 *    so the billing history offers it - its row text never points at a
 *    button that is not on the page.
 *  - "none": no Stripe customer, so there is no portal to point at.
 */
export type InvoicePortal = "page" | "here" | "none";

/** A card payment the webhook recorded without an invoice link. */
export function lacksCardInvoice(payment: { provider: string; invoiceUrl: string | null }): boolean {
  return payment.provider !== "paypal" && !payment.invoiceUrl;
}

/* ------------------------------------------------------------------------- */
/* Plans and allowances                                                       */
/* ------------------------------------------------------------------------- */

/** A limit as words: a negative limit means unlimited. */
function allowance(n: number, t: BillingCopy, locale: Locale): string {
  return n < 0 ? t.unlimited : formatNumber(n, locale);
}

/**
 * A plan's feature lines.
 *
 * Whole sentences per language from the dictionary, so the plural rule and
 * the word order stay each language's own. The site line is the fixed "one
 * website per subscription", not plan.siteLimit: subscriptions are per
 * website since migration 0021, and siteLimit is not enforced anywhere.
 */
export function planFeatures(plan: PlanRow, t: BillingCopy, locale: Locale): string[] {
  return [
    plural(t.articlesEachMonth, plan.articleLimit, { n: allowance(plan.articleLimit, t, locale) }),
    plural(t.searchTermsTracked, plan.keywordLimit, { n: allowance(plan.keywordLimit, t, locale) }),
    t.oneWebsite,
    plural(t.creditsEachMonth, plan.monthlyCredits, { n: allowance(plan.monthlyCredits, t, locale) }),
  ];
}

/**
 * The upgrade strip's sentence, built from the next plan's real limits.
 *
 * Through the same allowance wording as the plan cards, so an unlimited
 * limit reads "Unlimited" rather than "-1 articles", and numbers get the
 * reader's separators.
 */
export function upgradeSentence(plan: PlanRow, t: BillingCopy, locale: Locale): string {
  const [articles, terms, , credits] = planFeatures(plan, t, locale);
  return format(t.upgradeBody, { plan: plan.name, articles, terms, credits });
}

/** Annual saving against paying the monthly price twelve times, in whole percent. */
export function annualSaving(monthly: PlanRow | undefined, annual: PlanRow): number {
  if (!monthly) return 0;
  const full = monthly.priceCents * 12;
  if (full <= 0) return 0;
  return Math.round(((full - annual.priceCents) / full) * 100);
}

/**
 * Grid columns for the plan cards, by how many there are.
 *
 * Two plans in a four-column row left half the row empty once Starter was
 * retired; the grid now follows the line-up.
 *
 * Columns start at lg, not md: from md the sidebar takes 15rem, and two
 * cards in what is left (about 26rem of section) are too narrow for the
 * longer button labels ("Zu diesem Tarif wechseln", "Mit PayPal bezahlen").
 */
export function planGridClass(count: number): string {
  if (count <= 1) return "grid gap-4 md:max-w-md";
  if (count === 2) return "grid gap-4 lg:grid-cols-2";
  if (count === 3) return "grid gap-4 lg:grid-cols-2 xl:grid-cols-3";
  return "grid gap-4 lg:grid-cols-2 xl:grid-cols-4";
}

/* ------------------------------------------------------------------------- */
/* Return messages                                                            */
/* ------------------------------------------------------------------------- */

/** The query parameters a checkout returns with, removed once they have been read. */
export const RETURN_PARAMS = ["checkout", "addon", "paypal"] as const;

/**
 * The address without the return parameters, keeping ?site= and the hash.
 *
 * A reload used to toast "Payment received" again, because ?checkout=success
 * stayed in the address for good.
 */
export function withoutReturnParams(href: string): string | null {
  const url = new URL(href);
  if (!RETURN_PARAMS.some((key) => url.searchParams.has(key))) return null;
  for (const key of RETURN_PARAMS) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}
