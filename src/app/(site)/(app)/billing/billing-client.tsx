"use client";

import {
  Activity,
  Briefcase,
  Calendar,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Puzzle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PayPalMark } from "@/components/paypal-mark";
import { PayPalPendingPrompt } from "@/components/paypal-pending-prompt";
import type { PayPalPendingCopy } from "@/lib/i18n/paypal-pending";
import { PayPalReturn } from "@/components/paypal-return";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import {
  planDate,
  type CurrentSubscription,
  type PlanRow,
  type WebsiteSubscription,
} from "@/lib/billing-shared";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { BUY_CREDITS_PATH } from "@/lib/credits/buy-credits";
import { BILLING_PLANS_COPY } from "@/lib/i18n/billing-plans";
import { PAYMENT_CHOICE_COPY } from "@/lib/i18n/buy-credits";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import { CONFIRM_EMAIL_FIRST, isDirectPurchaseTier } from "@/lib/plans/features";
import type { OfferCodeCopy } from "@/lib/i18n/offer-code";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { readConsent } from "@/lib/consent";
import { trackMetaCheckout } from "@/lib/meta-pixel";
import { createPortalSession, type PortalFlow } from "@/lib/stripe/portal";
import { cn } from "@/lib/utils";

import type { PlanCardView } from "./plan-cards";
import { PlanPicker, type PlanPayment } from "./plan-picker";
import {
  paymentOptions,
  subscriptionStatus,
  upgradeSentence,
  withoutReturnParams,
} from "./billing-view";

type BillingClientProps = {
  plans: PlanRow[];
  subscription: CurrentSubscription | null;
  entitled: boolean;
  /**
   * False until PayPal can complete a checkout (credentials, webhook id and
   * mode); the button is hidden entirely. Per plan, it also needs the plan's
   * PayPal plan id (payPalForPlan).
   */
  paypalAvailable: boolean;
  /** "success" | "cancelled" after a card checkout. */
  checkout?: string;
  /** "success" | "cancelled" after a PayPal approval. */
  paypalResult?: string;
  /**
   * The website a new plan will pay for: the one currently selected. Null
   * when the workspace has no website yet, which blocks checkout rather than
   * selling a plan with nothing to attach it to.
   */
  websiteId: string | null;
  /** Every website and the plan paying for it. */
  websiteSubscriptions: WebsiteSubscription[];
  /**
   * The website the header is on when it is one SHARED with this person: its
   * owner pays for it, and this page is about their own websites instead.
   */
  viewingSharedDomain: string | null;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["billing"];
  /** For dates, prices and thousands separators. */
  locale: Locale;
  /** The REPGET field's words, or null while the offer is off. */
  offerCopy?: OfferCodeCopy | null;
  /** Why a PayPal-billed website cannot switch monthly <-> yearly (lib/i18n/paypal-plan-change.ts). */
  paypalIntervalNote?: string;
  /** The words for an unfinished PayPal payment that blocks paying another way (lib/i18n/paypal-pending.ts). */
  paypalPendingCopy?: PayPalPendingCopy;
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
  /**
   * Each plan card's price, terms and benefits, worked out on the server
   * (plan-cards.ts). A plan without one keeps the plain price and lines.
   */
  planCards?: Record<string, PlanCardView>;
  /** A plan change here keeps the REPGET launch price, and the offer is the one it already has. */
  launchPriceKept?: boolean;
  /** The plan a link names (?plan=, ?period=), checked by the page against what is on sale. */
  selectedPlan?: { tier: string; interval: "month" | "year" | null } | null;
  /** The add-ons on sale besides the credit packs, as links (the strip under the plans). */
  addonLinks?: { id: string; name: string; href: string }[];
  /** Shown first under the title. */
  top?: ReactNode;
};

/** Stored timestamps in one zone on server and browser, so the two renders agree. */
const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

const PAYPAL_AUTOPAY = "https://www.paypal.com/myaccount/autopay/";

export function BillingClient({
  plans: allPlans,
  subscription,
  entitled,
  paypalAvailable,
  checkout,
  paypalResult,
  websiteId,
  websiteSubscriptions,
  viewingSharedDomain,
  t,
  locale,
  offerCopy = null,
  paypalIntervalNote,
  paypalPendingCopy,
  tCommon,
  planCards = {},
  launchPriceKept = false,
  selectedPlan = null,
  addonLinks = [],
  top = null,
}: BillingClientProps) {
  /*
    Every plan on sale, the Grow + Visibility bundle included (Daniel,
    2026-11-13): it is bought outright - no free articles, no REPGET, the
    first payment at checkout (beginCheckout) - and its card says so.
  */
  const plans = allPlans;
  const router = useRouter();
  const [pending, setPending] = useState<PlanPayment | null>(null);
  const [paypalBlock, setPayPalBlock] = useState<(PlanPayment & { failed: boolean }) | null>(null);
  /** Which portal button is mid-flight, so only that one shows a spinner. */
  const [portalPending, setPortalPending] = useState<PortalFlow | null>(null);

  /*
    Return messages. The redirect only reports what the customer did;
    entitlement always comes from the webhook, so success says "received" or
    "confirming", never "active".

    The strings, not `t` itself, are the dependencies: the dictionary arrives
    from a server component as a fresh object on every render, and depending
    on it would toast again on every render.
  */
  const paymentReceived = t.paymentReceived;
  const checkoutCancelled = t.checkoutCancelled;
  useEffect(() => {
    if (checkout === "success") toast.success(paymentReceived);
    else if (checkout === "cancelled") toast(checkoutCancelled);
  }, [checkout, paymentReceived, checkoutCancelled]);

  /*
    PayPal returns with its own parameter. A PayPal subscription is APPROVED
    at PayPal and confirmed by its webhook, so it gets its own words rather
    than "payment received".
  */
  const paypalApproved = t.paypalApproved;
  const paypalCancelled = t.paypalCancelled;
  useEffect(() => {
    if (paypalResult === "success") toast.success(paypalApproved);
    else if (paypalResult === "cancelled") toast(paypalCancelled);
  }, [paypalResult, paypalApproved, paypalCancelled]);

  /*
    Once read, the return parameters leave the address (keeping ?site= and
    the hash), so a reload does not announce the same payment again.
  */
  useEffect(() => {
    const clean = withoutReturnParams(window.location.href);
    if (clean) window.history.replaceState(null, "", clean);
  }, []);

  /*
    The credit packs were at /billing#addons until they got their own page;
    old links, bookmarks and emails still carry that address. A hash never
    reaches the server, so it is followed here.
  */
  useEffect(() => {
    const follow = () => {
      if (window.location.hash === "#addons") router.replace(BUY_CREDITS_PATH);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router]);

  const copy = BILLING_PLANS_COPY[locale];
  const options = paymentOptions(subscription, paypalAvailable);
  const selected = websiteSubscriptions.find((row) => row.websiteId === websiteId) ?? null;
  const domain = selected?.domain ?? null;
  const status = subscription ? subscriptionStatus(subscription.status, t) : null;
  const date = (value: Date) => formatDate(value, locale, DATE);
  /*
    On its free articles through PayPal (2026-10-22). PayPal cannot cut the
    free days short, so "Start my plan now" starts the plan with a new PayPal
    subscription, charged at once, that takes over from the free one; any
    plan chosen below does the same (beginCheckout, subscription-sync.ts).
  */
  const paypalFree = subscription?.provider === "paypal" && subscription.status === "trialing";

  /*
    Says why one processor's button is missing: a website paying through one
    processor changes its plan there, and starting the other is refused while
    that subscription is live. A card subscription already set to end is
    still live until its period ends (beginCheckout refuses PayPal until the
    row is cancelled, not merely cancelling), and its Cancel button is gone,
    so it gets the date PayPal opens rather than "cancel it first".
  */
  const processorNote =
    paypalFree && options.paypal
      ? // On its free articles through PayPal: a plan chosen below starts at once.
        t.paypalFreePlans
      : options.billedBy === "paypal"
        ? subscription?.cancelAtPeriodEnd && planDate(subscription)
          ? // Cancelled in PayPal, its paid time still running (review M1): when a plan can be chosen again.
            format(t.billedByPayPalEnding, { date: date(planDate(subscription)!) })
          : t.billedByPayPal
        : options.billedBy === "stripe" && options.card && paypalAvailable
          ? subscription?.cancelAtPeriodEnd
            ? planDate(subscription)
              ? format(t.billedByCardEnding, { date: date(planDate(subscription)!) })
              : null
            : t.billedByCard
          : null;

  // Card or PayPal (review P5); applied by the server by itself (lib/billing/repget-offer.ts), so only said here.
  const payable = options.card || options.paypal;
  const offer = !payable
    ? null
    : launchPriceKept
      ? { title: copy.keptTitle, body: copy.keptBody }
      : offerCopy
        ? { title: offerCopy.label, body: offerCopy.help }
        : null;

  /**
   * Paying was refused because a PayPal payment for this website was started
   * and never finished: shown above the plans with a button that cancels it
   * and carries on (components/paypal-pending-prompt.tsx). `failed`: the
   * repeat after cancelling was refused again.
   */
  function showPayPalBlock(planId: string, provider: "stripe" | "paypal", afterCancel: boolean) {
    setPending(null);
    setPayPalBlock({ planId, provider, failed: afterCancel });
  }

  async function handleCard(planId: string, afterCancel = false) {
    setPending({ planId, provider: "stripe" });
    try {
      /*
        Subscribes the SELECTED website. A plan pays for one site, so this
        page buys only for the site it describes.
      */
      if (!websiteId) {
        toast.error(t.addWebsiteFirst);
        setPending(null);
        return;
      }
      const result = await createCheckoutSession(planId, websiteId, "billing");
      /*
        A new workspace confirms its email before the free articles, and
        the code box is on the onboarding plan screen - which also states
        the offer's terms. Sent there rather than left with a refusal.
      */
      if ("error" in result && result.error === CONFIRM_EMAIL_FIRST) {
        router.push(`/onboarding/plan?site=${encodeURIComponent(websiteId)}`);
        return;
      }
      if ("error" in result && result.pendingPayPal) {
        showPayPalBlock(planId, "stripe", afterCancel);
        return;
      }
      if ("error" in result) {
        toast.error(result.error);
        setPending(null);
        return;
      }
      // Meta's InitiateCheckout, for a visitor who accepted (lib/meta-pixel.ts); a moment for it, then on.
      await trackMetaCheckout(result.metaCheckout, readConsent());
      // assign() rather than `location.href = ...`: the React Compiler treats
      // assigning to an outer value as a mutation, while a method call is not.
      window.location.assign(result.url);
    } catch {
      toast.error(t.checkoutFailed);
      setPending(null);
    }
  }

  async function handlePayPal(planId: string, afterCancel = false) {
    setPending({ planId, provider: "paypal" });
    try {
      if (!websiteId) {
        toast.error(t.addWebsiteFirst);
        setPending(null);
        return;
      }
      const result = await createPayPalCheckout(planId, websiteId, "billing");
      // PayPal gives the free articles too (2026-10-22): the same confirmed address first, on the same screen as card.
      if ("error" in result && result.error === CONFIRM_EMAIL_FIRST) {
        router.push(`/onboarding/plan?site=${encodeURIComponent(websiteId)}`);
        return;
      }
      if ("error" in result && result.pendingPayPal) {
        showPayPalBlock(planId, "paypal", afterCancel);
        return;
      }
      if ("error" in result) {
        toast.error(result.error);
        setPending(null);
        return;
      }
      await trackMetaCheckout(result.metaCheckout, readConsent());
      window.location.assign(result.url);
    } catch {
      toast.error(t.paypalCheckoutFailed);
      setPending(null);
    }
  }

  /**
   * Every route out of a card subscription goes through the Stripe portal:
   * "cancel" lands on Stripe's own cancellation screen (the confirmation),
   * "manage" on the portal home. Doing either against the API directly would
   * skip that confirmation and the webhooks that keep our row in step.
   */
  async function handlePortal(flow: PortalFlow) {
    setPortalPending(flow);
    try {
      // The selected website's subscription, never "the newest one".
      const result = await createPortalSession(flow, websiteId);
      if ("error" in result) {
        toast.error(result.error);
        setPortalPending(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error(t.portalFailed);
      setPortalPending(null);
    }
  }

  /*
    The next plan up, for the upgrade strip: the next MONTHLY rung in the
    picker's own order. Only for an entitled subscriber below the top tier -
    "ready to scale?" to somebody already on Scale, or to a lapsed site,
    says the product is not paying attention.
  */
  const monthlyLadder = plans
    // The bundle is not a rung: it is Grow with perks, sold on its own terms.
    .filter((plan) => plan.interval === "month" && !isDirectPurchaseTier(plan.tier))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const currentRung = subscription?.tier
    ? monthlyLadder.findIndex((plan) => plan.tier === subscription.tier)
    : -1;
  const upgradeTarget =
    entitled && currentRung >= 0 && currentRung < monthlyLadder.length - 1
      ? monthlyLadder[currentRung + 1]
      : null;

  const block = paypalBlock;
  const pendingPrompt =
    block && websiteId && paypalPendingCopy ? (
      <PayPalPendingPrompt
        websiteId={websiteId}
        copy={paypalPendingCopy}
        failed={block.failed}
        onContinue={() =>
          block.provider === "stripe" ? handleCard(block.planId, true) : handlePayPal(block.planId, true)
        }
      />
    ) : null;
  const words = pricingPageCopy(locale);
  // What paying yearly saves, as /pricing says it: with the launch price while the cards carry it.
  const yearly = plans.find((plan) => plan.interval === "year");
  const annualNote = yearly
    ? planCards[yearly.id]?.strike
      ? words.billing.saving
      : words.billing.savingPlain
    : null;

  const planFooter =
    options.manageInPayPal || options.manageInStripe || options.managedForYou ? (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {options.manageInPayPal ? (
          /*
            PayPal has no portal we can open for the customer, so this points
            at where their subscription, receipts and cancellation live.
          */
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={PAYPAL_AUTOPAY} target="_blank" rel="noopener noreferrer">
                {tCommon.manageInPayPal}
                <ExternalLink className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.newTab}</span>
              </a>
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">{t.paypalReceipts}</p>
          </>
        ) : null}

        {options.manageInStripe ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePortal("manage")}
              disabled={portalPending !== null}
            >
              {portalPending === "manage" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : null}
              {portalPending === "manage" ? t.opening : tCommon.manageBilling}
              <ExternalLink className="size-4" aria-hidden="true" />
            </Button>
            {/*
              Opens Stripe's cancellation screen, which is the confirmation:
              serious styling without claiming the click itself cancels.
            */}
            {options.cancelInStripe ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePortal("cancel")}
                disabled={portalPending !== null}
                className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                {portalPending === "cancel" ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : null}
                {portalPending === "cancel" ? t.opening : t.cancelSubscription}
              </Button>
            ) : null}
          </>
        ) : null}

        {options.managedForYou ? <ManagedForYou template={t.managedForYou} /> : null}
      </div>
    ) : null;

  return (
    <>
      {/*
        No description: the client cut the subtitle ("Each website has its own
        plan…") because the list of websites already shows a plan per website.
      */}
      <PageHeader title={t.title} />

      {/*
        Back from PayPal: the subscription is read back (or a walked-away
        approval released) for the website this page buys for. Renders nothing.
      */}
      <PayPalReturn outcome={paypalResult} websiteId={websiteId} />

      {top}

      {viewingSharedDomain ? (
        <Notice tone="info">{format(t.viewingSharedNote, { shared: viewingSharedDomain })}</Notice>
      ) : null}

      {/* #plan: where "View plan" and the upgrade links land - the current plan if there is one, the plans otherwise. */}
      <div id="plan" className="scroll-mt-20 space-y-8">
        {/*
          What this website has now, first: named, so it is never a guess which site
          "Current plan" describes. The processor's own routes out (Stripe
          portal, PayPal, support) sit in the footer - only the ones that can
          work for THIS website's processor.
        */}
        {subscription || !websiteId ? (
          <WorkspaceSection
            id="current-plan"
            icon={CreditCard}
            title={domain ? format(t.planFor, { domain }) : t.currentPlan}
            footer={planFooter}
          >
            <div className="space-y-4">
              {!websiteId && !subscription ? (
                <Notice
                  tone="info"
                  action={
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/websites/new">
                        <Plus className="size-4" aria-hidden="true" />
                        {t.addWebsite}
                      </Link>
                    </Button>
                  }
                >
                  {t.addWebsiteFirst}
                </Notice>
              ) : null}

              {subscription ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
                        {t.currentPlan}
                      </dt>
                      <dd className="mt-2 text-xl font-semibold tracking-tight wrap-anywhere text-foreground">
                        {subscription.planName ?? "—"}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                        {subscription.cancelAtPeriodEnd ? t.accessEnds : t.nextInvoice}
                      </dt>
                      <dd className="mt-2 text-xl font-semibold tracking-tight tabular-nums wrap-anywhere text-foreground">
                        {planDate(subscription) ? date(planDate(subscription)!) : "—"}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {/* A neutral mark: a tick beside "Payment overdue" would contradict the words. */}
                        <Activity className="size-3.5 shrink-0" aria-hidden="true" />
                        {t.status}
                      </dt>
                      {/*
                        The words carry the status; the tint only repeats a
                        warning or a failure for those who see it.
                      */}
                      <dd
                        className={cn(
                          "mt-2 text-xl font-semibold tracking-tight wrap-anywhere",
                          status?.tone === "warning"
                            ? "text-amber-700 dark:text-amber-400"
                            : status?.tone === "critical"
                              ? "text-red-700 dark:text-red-400"
                              : "text-foreground",
                        )}
                      >
                        {status?.label}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-sm text-muted-foreground">
                    {subscription.planName ? format(t.onPlan, { plan: subscription.planName }) : null}
                    {planDate(subscription) ? (
                      <>
                        {subscription.planName ? " " : null}
                        {format(subscription.cancelAtPeriodEnd ? t.accessEndsOn : t.renewsOn, {
                          date: date(planDate(subscription)!),
                        })}
                      </>
                    ) : null}
                  </p>

                  {subscription.status === "past_due" ? (
                    <Notice tone="warning">{t.pastDueNotice}</Notice>
                  ) : options.unsettled ? (
                    <Notice tone="warning">{t.unsettledNotice}</Notice>
                  ) : subscription.status === "canceled" || subscription.status === "incomplete_expired" ? (
                    <Notice tone="info">{t.endedNotice}</Notice>
                  ) : paypalFree && options.paypal && subscription.planId ? (
                    <Notice
                      tone="info"
                      title={
                        subscription.planName && subscription.currentPeriodEnd
                          ? format(t.paypalFreeTitle, {
                              plan: subscription.planName,
                              date: date(subscription.currentPeriodEnd),
                            })
                          : undefined
                      }
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending !== null}
                          onClick={() => handlePayPal(subscription.planId!)}
                        >
                          {pending?.planId === subscription.planId && pending?.provider === "paypal" ? (
                            <>
                              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              {t.redirecting}
                            </>
                          ) : (
                            <>
                              <PayPalMark className="size-5" />
                              {t.startPlanNow}
                            </>
                          )}
                        </Button>
                      }
                    >
                      {t.paypalFreeBody}
                    </Notice>
                  ) : null}

                  {upgradeTarget ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
                      <p className="min-w-0 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{t.upgradeLead}</span>{" "}
                        {upgradeSentence(upgradeTarget, t, locale)}
                      </p>
                      <a
                        href="#plans"
                        className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {format(t.upgradeLink, { plan: upgradeTarget.name })}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </a>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </WorkspaceSection>
        ) : null}

        {/* The plans, for the same website (#plans). */}
        <PlanPicker
          // Another website, or a link to another plan, starts the choice afresh.
          key={[websiteId, selectedPlan?.tier, selectedPlan?.interval].join(":")}
          plans={plans}
          planCards={planCards}
          subscription={subscription}
          entitled={entitled}
          options={options}
          domain={domain}
          websiteId={websiteId}
          websiteSubscriptions={websiteSubscriptions}
          processorNote={processorNote}
          offer={offer}
          annualNote={annualNote}
          selectedTier={selectedPlan?.tier ?? null}
          initialInterval={selectedPlan?.interval ?? (subscription?.interval === "year" ? "year" : "month")}
          status={websiteId && !subscription ? t.noSubscription : null}
          pending={pending}
          onPay={(planId, provider) => (provider === "paypal" ? handlePayPal(planId) : handleCard(planId))}
          paypalIntervalNote={paypalIntervalNote}
          blockedPlanId={block?.planId ?? null}
          pendingPrompt={pendingPrompt}
          copy={copy}
          choice={PAYMENT_CHOICE_COPY[locale]}
          usageNote={words.compare.usageNote}
          t={t}
          tCommon={tCommon}
          locale={locale}
        />
      </div>

      {/* Everything else on sale, on its own page: one-off purchases must not compete with choosing a plan. */}
      <section
        id="addons"
        aria-labelledby="addons-title"
        className="flex scroll-mt-20 flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <Puzzle className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="addons-title" className="text-base font-semibold tracking-tight text-foreground">
              {copy.addonsTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.addonsBody}</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2 sm:justify-end">
          {[{ id: "packs", name: copy.creditPacks, href: BUY_CREDITS_PATH }, ...addonLinks].map((link) => (
            <li key={link.id}>
              <Link
                href={link.href}
                className="inline-flex rounded-lg border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground/80 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/*
        One row per website: each is billed separately, so a customer may have
        several plans and one site not paid for at all - the row that matters
        most. With more than one, each row opens that site's plan above.
      */}
      {websiteSubscriptions.length > 0 ? (
        <WorkspaceSection id="websites" icon={Globe} title={t.yourWebsites}>
          <ul className="divide-y rounded-lg border">
            {websiteSubscriptions.map((row) => {
              const rowStatus = subscriptionStatus(row.status, t);
              const isSelected = row.websiteId === websiteId;
              return (
                <li
                  key={row.websiteId}
                  aria-current={isSelected && websiteSubscriptions.length > 1 ? "true" : undefined}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                    isSelected && websiteSubscriptions.length > 1 && "bg-muted/30",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium wrap-anywhere text-foreground">{row.domain}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.planName
                        ? planDate(row)
                          ? format(row.cancelAtPeriodEnd ? t.planEnds : t.planRenews, {
                              plan: row.planName,
                              date: date(planDate(row)!),
                            })
                          : row.planName
                        : t.noPlanYet}
                    </p>
                  </div>
                  <StatusBadge
                    status={rowStatus.badge}
                    label={rowStatus.label}
                    tone={rowStatus.tone}
                    animate={false}
                  />
                  {websiteSubscriptions.length > 1 ? (
                    isSelected ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {copy.shownAbove}
                      </span>
                    ) : (
                      <Link
                        href={`/billing?site=${row.websiteId}#plan`}
                        className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {t.viewPlan}
                        <span className="sr-only">{` - ${row.domain}`}</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </WorkspaceSection>
      ) : null}
    </>
  );
}

/** "Contact {email}", with the address as a working link in any language's word order. */
function ManagedForYou({ template }: { template: string }) {
  const [before, after = ""] = template.split("{email}");
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      {before}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {SUPPORT_EMAIL}
      </a>
      {after}
    </p>
  );
}
