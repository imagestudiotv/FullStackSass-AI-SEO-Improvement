"use client";

import {
  Activity,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PayPalMark } from "@/components/paypal-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import {
  type CurrentSubscription,
  type PlanRow,
  type WebsiteSubscription,
} from "@/lib/billing-shared";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { STARTER_TIER } from "@/lib/plans/features";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { createPortalSession, type PortalFlow } from "@/lib/stripe/portal";
import { cn } from "@/lib/utils";

import {
  annualSaving,
  formatMoney,
  paymentOptions,
  planFeatures,
  planGridClass,
  subscriptionStatus,
  upgradeSentence,
  withoutReturnParams,
} from "./billing-view";

type BillingClientProps = {
  plans: PlanRow[];
  subscription: CurrentSubscription | null;
  entitled: boolean;
  /** False until PayPal credentials exist; the button is hidden entirely. */
  paypalAvailable: boolean;
  /** "success" | "cancelled" after a card checkout. */
  checkout?: string;
  /** "success" | "cancelled" after an add-on checkout. */
  addonResult?: string;
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
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
};

/** Stored timestamps in one zone on server and browser, so the two renders agree. */
const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

/**
 * A full-width card button whose label may wrap: in a narrow column a long
 * translation ("Zu diesem Tarif wechseln") would otherwise run out of the
 * card. One line still renders at the standard h-8.
 */
const CARD_BUTTON = "h-auto min-h-8 w-full py-1.5 text-center whitespace-normal";

const PAYPAL_AUTOPAY = "https://www.paypal.com/myaccount/autopay/";

export function BillingClient({
  plans,
  subscription,
  entitled,
  paypalAvailable,
  checkout,
  addonResult,
  paypalResult,
  websiteId,
  websiteSubscriptions,
  viewingSharedDomain,
  t,
  locale,
  tCommon,
}: BillingClientProps) {
  const [interval, setBillingInterval] = useState<"month" | "year">(
    subscription?.interval === "year" ? "year" : "month",
  );
  const [pending, setPending] = useState<{ planId: string; provider: "stripe" | "paypal" } | null>(null);
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

  const purchaseReceived = t.purchaseReceived;
  const purchaseCancelled = t.purchaseCancelled;
  useEffect(() => {
    if (addonResult === "success") toast.success(purchaseReceived);
    else if (addonResult === "cancelled") toast(purchaseCancelled);
  }, [addonResult, purchaseReceived, purchaseCancelled]);

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

  const options = paymentOptions(subscription, paypalAvailable);
  const selected = websiteSubscriptions.find((row) => row.websiteId === websiteId) ?? null;
  const domain = selected?.domain ?? null;
  const status = subscription ? subscriptionStatus(subscription.status, t) : null;
  const date = (value: Date) => formatDate(value, locale, DATE);

  /*
    Says why one processor's button is missing: a website paying through one
    processor changes its plan there, and starting the other is refused while
    that subscription is live. A card subscription already set to end is
    still live until its period ends (beginCheckout refuses PayPal until the
    row is cancelled, not merely cancelling), and its Cancel button is gone,
    so it gets the date PayPal opens rather than "cancel it first".
  */
  const processorNote =
    options.billedBy === "paypal"
      ? t.billedByPayPal
      : options.billedBy === "stripe" && options.card && paypalAvailable
        ? subscription?.cancelAtPeriodEnd
          ? subscription.currentPeriodEnd
            ? format(t.billedByCardEnding, { date: date(subscription.currentPeriodEnd) })
            : null
          : t.billedByCard
        : null;

  async function handleCard(planId: string) {
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
      const result = await createCheckoutSession(planId, websiteId);
      if ("error" in result) {
        toast.error(result.error);
        setPending(null);
        return;
      }
      // assign() rather than `location.href = ...`: the React Compiler treats
      // assigning to an outer value as a mutation, while a method call is not.
      window.location.assign(result.url);
    } catch {
      toast.error(t.checkoutFailed);
      setPending(null);
    }
  }

  async function handlePayPal(planId: string) {
    setPending({ planId, provider: "paypal" });
    try {
      if (!websiteId) {
        toast.error(t.addWebsiteFirst);
        setPending(null);
        return;
      }
      const result = await createPayPalCheckout(planId, websiteId);
      if ("error" in result) {
        toast.error(result.error);
        setPending(null);
        return;
      }
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
    .filter((plan) => plan.interval === "month")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const currentRung = subscription?.tier
    ? monthlyLadder.findIndex((plan) => plan.tier === subscription.tier)
    : -1;
  const upgradeTarget =
    entitled && currentRung >= 0 && currentRung < monthlyLadder.length - 1
      ? monthlyLadder[currentRung + 1]
      : null;

  const monthlyByTier = new Map(monthlyLadder.map((plan) => [plan.tier, plan]));
  const annualTiers = new Set(plans.filter((plan) => plan.interval === "year").map((plan) => plan.tier));
  const hasAnnual = annualTiers.size > 0;
  /*
    Tiers sold only monthly (Starter) stay on the annual tab at their monthly
    price, rather than vanishing the moment someone clicks "Annual".
  */
  const plansFor = (period: "month" | "year") =>
    plans.filter((plan) =>
      period === "year"
        ? plan.interval === "year" || (plan.interval === "month" && !annualTiers.has(plan.tier))
        : plan.interval === "month",
    );

  function planCard(plan: PlanRow) {
    const isCurrent = subscription?.planId === plan.id && entitled;
    const saving = plan.interval === "year" ? annualSaving(monthlyByTier.get(plan.tier), plan) : 0;
    const busy = pending?.planId === plan.id;
    const headingId = `plan-${plan.id}`;

    return (
      <article
        key={plan.id}
        aria-labelledby={headingId}
        className={cn(
          "flex min-w-0 flex-col rounded-lg border p-4",
          isCurrent ? "border-primary/40 bg-primary/5" : "bg-card",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-base font-semibold text-foreground">
            {plan.name}
          </h3>
          {plan.tier === STARTER_TIER ? (
            <Badge
              variant="secondary"
              className="border border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            >
              {t.tryItFirst}
            </Badge>
          ) : null}
          {saving > 0 ? (
            <Badge variant="secondary" className="ml-auto">
              {format(t.saveBadge, { n: saving })}
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatMoney(plan.priceCents, plan.currency, locale)}
          </span>
          <span className="text-sm text-muted-foreground">
            {plan.interval === "year" ? t.perYear : t.perMonth}
          </span>
        </p>

        <ul className="mt-4 flex-1 space-y-2 border-t pt-4 text-sm">
          {planFeatures(plan, t, locale).map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          {isCurrent ? (
            <Button className={CARD_BUTTON} variant="outline" disabled>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t.currentPlan}
            </Button>
          ) : (
            <>
              {options.card ? (
                <Button className={CARD_BUTTON} disabled={pending !== null} onClick={() => handleCard(plan.id)}>
                  {busy && pending?.provider === "stripe" ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {t.redirecting}
                    </>
                  ) : entitled ? (
                    t.switchPlan
                  ) : (
                    t.payByCard
                  )}
                </Button>
              ) : null}
              {/*
                Only where PayPal can complete: configured, and the website is
                not already paying by card (beginCheckout refuses a second
                processor while one subscription is live).
              */}
              {options.paypal ? (
                <Button
                  className={CARD_BUTTON}
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => handlePayPal(plan.id)}
                >
                  {busy && pending?.provider === "paypal" ? (
                    <>
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {t.redirecting}
                    </>
                  ) : (
                    <>
                      <PayPalMark className="size-6" />
                      {tCommon.payWithPayPal}
                    </>
                  )}
                </Button>
              ) : null}
              {!options.card && !options.paypal ? (
                <p className="text-xs leading-5 text-muted-foreground">{t.noPlanChange}</p>
              ) : null}
            </>
          )}
        </div>
      </article>
    );
  }

  function planGrid(period: "month" | "year") {
    const list = plansFor(period);
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground">{tCommon.noPlans}</p>;
    }
    return <div className={planGridClass(list.length)}>{list.map(planCard)}</div>;
  }

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
        plan…") because the rows below already show a plan per website.
      */}
      <PageHeader title={t.title} />

      {viewingSharedDomain ? (
        <Notice tone="info">{format(t.viewingSharedNote, { shared: viewingSharedDomain })}</Notice>
      ) : null}

      {/*
        One row per website: each is billed separately, so a customer may have
        several plans and one site not paid for at all - the row that matters
        most. With more than one, each row opens that site's plan below.
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
                        ? row.currentPeriodEnd
                          ? format(row.cancelAtPeriodEnd ? t.planEnds : t.planRenews, {
                              plan: row.planName,
                              date: date(row.currentPeriodEnd),
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
                        {t.shownBelow}
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

      {/*
        The selected website's plan, named, so it is never a guess which site
        "Current plan" describes. The processor's own routes out (Stripe
        portal, PayPal, support) sit in the footer - only the ones that can
        work for THIS website's processor.
      */}
      <WorkspaceSection
        id="plan"
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
                    {subscription.currentPeriodEnd ? date(subscription.currentPeriodEnd) : "—"}
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
                        ? "text-amber-700"
                        : status?.tone === "critical"
                          ? "text-red-700"
                          : "text-foreground",
                    )}
                  >
                    {status?.label}
                  </dd>
                </div>
              </dl>

              <p className="text-sm text-muted-foreground">
                {subscription.planName ? format(t.onPlan, { plan: subscription.planName }) : null}
                {subscription.currentPeriodEnd ? (
                  <>
                    {subscription.planName ? " " : null}
                    {format(subscription.cancelAtPeriodEnd ? t.accessEndsOn : t.renewsOn, {
                      date: date(subscription.currentPeriodEnd),
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
          ) : websiteId ? (
            <p className="text-sm text-muted-foreground">{t.noSubscription}</p>
          ) : null}
        </div>
      </WorkspaceSection>

      {/*
        The plans, for the same website. #plans is the upgrade strip's target
        (and scroll-mt keeps the heading clear of the sticky header).
      */}
      {hasAnnual ? (
        <Tabs
          value={interval}
          onValueChange={(value) => setBillingInterval(value === "year" ? "year" : "month")}
          className="block"
        >
          <PlansSection
            domain={domain}
            t={t}
            tCommon={tCommon}
            options={options}
            processorNote={processorNote}
            actions={
              <TabsList aria-label={t.billingPeriod}>
                <TabsTrigger value="month">{t.monthly}</TabsTrigger>
                <TabsTrigger value="year">{t.annual}</TabsTrigger>
              </TabsList>
            }
          >
            {(["month", "year"] as const).map((period) => (
              <TabsContent
                key={period}
                value={period}
                className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {planGrid(period)}
              </TabsContent>
            ))}
          </PlansSection>
        </Tabs>
      ) : (
        <PlansSection domain={domain} t={t} tCommon={tCommon} options={options} processorNote={processorNote}>
          {planGrid("month")}
        </PlansSection>
      )}
    </>
  );
}

/** The "Choose a plan" section frame, shared by the with- and without-annual layouts. */
function PlansSection({
  domain,
  t,
  tCommon,
  options,
  processorNote,
  actions,
  children,
}: {
  domain: string | null;
  t: Messages["app"]["billing"];
  tCommon: Messages["app"]["common"];
  options: ReturnType<typeof paymentOptions>;
  /** Why one processor's buttons are missing, already worded; null when nothing is. */
  processorNote: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <WorkspaceSection
      id="plans"
      icon={Layers}
      title={domain ? format(t.choosePlanFor, { domain }) : t.choosePlan}
      description={t.choosePlanHelp}
      actions={actions}
    >
      <div className="space-y-4">
        {processorNote ? <Notice tone="info">{processorNote}</Notice> : null}
        {children}
        {options.card && options.paypal ? (
          <p className="text-center text-xs text-muted-foreground">{tCommon.promoCodesHelp}</p>
        ) : null}
      </div>
    </WorkspaceSection>
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
