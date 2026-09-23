"use client";

import {
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PauseCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { STARTER_TIER } from "@/lib/plans/features";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPrice,
  isEntitled,
  type CurrentSubscription,
  type PlanRow,
  WebsiteSubscription,
} from "@/lib/billing-shared";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { createPortalSession, type PortalFlow } from "@/lib/stripe/portal";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

type BillingClientProps = {
  plans: PlanRow[];
  subscription: CurrentSubscription | null;
  entitled: boolean;
  /** False until PayPal credentials exist; the button is hidden entirely. */
  paypalAvailable: boolean;
  checkout?: string;
  /** "success" | "cancelled" after an add-on checkout. */
  addonResult?: string;
  /**
   * The website a new plan will pay for: the one currently selected. Null
   * when the workspace has no website yet, which blocks checkout rather than
   * selling a plan with nothing to attach it to.
   */
  websiteId: string | null;
  /** Every website and the plan paying for it. */
  websiteSubscriptions: WebsiteSubscription[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["billing"];
  /** For dates and thousands separators. */
  locale: Locale;
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
  /** The status vocabulary, for the badges. */
  tStatus: Messages["app"]["status"];
};

function planFeatures(
  plan: PlanRow,
  t: Messages["app"]["billing"],
  locale: Locale,
): string[] {
  /*
    The pluralising lives in the dictionary now. Each sentence is built per
    language there, because the plural rule and the word order both move —
    a count assembled beside a noun here would impose English grammar on the
    other four, and "1 articles written each month" on the entry plan is the
    first thing a prospective customer reads.
  */
  const unlimited = (n: number) =>
    n < 0 ? t.unlimited : formatNumber(n, locale);

  return [
    t.articlesEachMonth(unlimited(plan.articleLimit), plan.articleLimit),
    t.searchTermsTracked(unlimited(plan.keywordLimit), plan.keywordLimit),
    /*
      One website, not plan.siteLimit. Subscriptions are per WEBSITE since
      migration 0021, so a plan row's siteLimit describes a cap that is no
      longer enforced anywhere — quoting it here promised Grow customers three
      sites for one payment. See lib/plans/features.ts.
    */
    t.oneWebsite,
    t.creditsEachMonth(unlimited(plan.monthlyCredits), plan.monthlyCredits),
  ];
}

/** Annual saving vs paying the monthly price twelve times. */
function annualSaving(monthly: PlanRow | undefined, annual: PlanRow): number {
  if (!monthly) return 0;
  const full = monthly.priceCents * 12;
  if (full <= 0) return 0;
  return Math.round(((full - annual.priceCents) / full) * 100);
}

export function BillingClient({
  plans,
  subscription,
  entitled,
  paypalAvailable,
  checkout,
  addonResult,
  websiteId,
  websiteSubscriptions,
  t,
  locale,
  tCommon,
  tStatus,
}: BillingClientProps) {
  const [interval, setInterval] = useState<"month" | "year">(
    subscription?.interval === "year" ? "year" : "month",
  );
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  /** Which portal button is mid-flight, so only that one shows a spinner. */
  const [portalPending, setPortalPending] = useState<PortalFlow | null>(null);

  /**
   * The redirect only reports what the user did; entitlement always comes from
   * the webhook. The success copy therefore says "confirming", never "active".
   */
  /*
    The two strings, not `t` itself. The dictionary arrives from a server
    component, so it is a fresh object on every render — depending on it
    would re-fire this toast while ?checkout=success is still in the URL,
    and the customer would see "Payment received" twice.
  */
  const paymentReceived = t.paymentReceived;
  const checkoutCancelled = t.checkoutCancelled;
  useEffect(() => {
    if (checkout === "success") {
      toast.success(paymentReceived);
    } else if (checkout === "cancelled") {
      toast(checkoutCancelled);
    }
  }, [checkout, paymentReceived, checkoutCancelled]);

  /**
   * Add-ons land back on the same page with their own parameter. Like the
   * subscription message above, this says "received" rather than "added" —
   * the webhook grants the credits, and it may not have arrived yet.
   */
  const purchaseReceived = t.purchaseReceived;
  const purchaseCancelled = t.purchaseCancelled;
  useEffect(() => {
    if (addonResult === "success") {
      toast.success(purchaseReceived);
    } else if (addonResult === "cancelled") {
      toast(purchaseCancelled);
    }
  }, [addonResult, purchaseReceived, purchaseCancelled]);

  async function handleSelect(planId: string) {
    setPendingPlanId(planId);
    try {
      /**
       * Subscribes the SELECTED website. A plan pays for one site now, so
       * this page can only buy for the site the switcher is on — a customer
       * with several subscribes each in turn.
       */
      if (!websiteId) {
        toast.error(t.addWebsiteFirst);
        setPendingPlanId(null);
        return;
      }
      const result = await createCheckoutSession(planId, websiteId);
      if ("error" in result) {
        toast.error(result.error);
        setPendingPlanId(null);
        return;
      }
      // assign() rather than `location.href = ...`: the React Compiler
      // treats assigning to a value defined outside the component as a
      // mutation, while a method call is allowed.
      window.location.assign(result.url);
    } catch {
      toast.error(t.checkoutFailed);
      setPendingPlanId(null);
    }
  }

  async function handlePayPal(planId: string) {
    setPendingPlanId(planId);
    try {
      // Same site as the card path: a plan pays for one website.
      if (!websiteId) {
        toast.error(t.addWebsiteFirst);
        setPendingPlanId(null);
        return;
      }
      const result = await createPayPalCheckout(planId, websiteId);
      if ("error" in result) {
        toast.error(result.error);
        setPendingPlanId(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error("Could not start PayPal checkout. Please try again.");
      setPendingPlanId(null);
    }
  }

  /**
   * Every route out of a subscription goes through the Stripe portal.
   *
   * "cancel" lands on Stripe's cancellation screen; "manage" opens the portal
   * home, which is where pausing, resuming and card changes live. Doing any of
   * this against the API directly would skip the confirmation the customer
   * expects and the webhooks that keep our own row in step.
   */
  async function handlePortal(flow: PortalFlow = "manage") {
    setPortalPending(flow);
    try {
      const result = await createPortalSession(flow);
      if ("error" in result) {
        toast.error(result.error);
        setPortalPending(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error("Could not open the billing portal.");
      setPortalPending(null);
    }
  }

  const monthlyByTier = new Map(
    plans.filter((p) => p.interval === "month").map((p) => [p.tier, p]),
  );

  /**
   * The next plan up, for the upgrade strip.
   *
   * Ordered by sortOrder — the same order the picker below uses — so "next"
   * means the next one a customer would actually move to, not whichever is
   * most expensive. Null when there is no current subscription, when the tier
   * is unrecognised, or when they are already on the last plan; each of those
   * is a case where the strip has nothing true to say.
   */
  const monthlyLadder = plans
    .filter((p) => p.interval === "month")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const currentRung = subscription?.tier
    ? monthlyLadder.findIndex((p) => p.tier === subscription.tier)
    : -1;
  const upgradeTarget =
    currentRung >= 0 && currentRung < monthlyLadder.length - 1
      ? monthlyLadder[currentRung + 1]
      : null;
  /**
   * Tiers that exist only monthly — Starter — still show on the annual tab.
   *
   * Filtering strictly by interval would make the cheapest plan vanish the
   * moment someone clicks "Annual", with no explanation. Falling back to the
   * monthly row keeps the full line-up visible; the card shows its real
   * monthly price, which is the only price it has.
   */
  const annualTiers = new Set(
    plans.filter((p) => p.interval === "year").map((p) => p.tier),
  );
  const visible = plans.filter((p) =>
    interval === "year"
      ? p.interval === "year" ||
        (p.interval === "month" && !annualTiers.has(p.tier))
      : p.interval === "month",
  );
  const hasAnnual = plans.some((p) => p.interval === "year");

  return (
    <PageShell>
      <PageHeader
        title={t.title}
        description={t.subtitle}
      />

      {/*
        One row per website.
        
        A single "current plan" cannot describe an account any more: each site
        is billed separately, so a customer may have three plans, three
        renewal dates and one site not paid for at all. The unpaid one is the
        row that matters most — it is the site that cannot generate anything.
      */}
      {websiteSubscriptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.yourWebsites}</CardTitle>
            <CardDescription>{t.yourWebsitesHelp}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {websiteSubscriptions.map((row) => (
                <li
                  key={row.websiteId}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.domain}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.planName
                        ? row.currentPeriodEnd
                          ? row.cancelAtPeriodEnd
                            ? t.planEnds(
                                row.planName,
                                formatDate(row.currentPeriodEnd, locale),
                              )
                            : t.planRenews(
                                row.planName,
                                formatDate(row.currentPeriodEnd, locale),
                              )
                          : row.planName
                        : t.noPlanYet}
                    </p>
                  </div>
                  <StatusBadge status={row.status} t={tStatus} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/*
        The three-tile summary from the client's design: current plan, next
        invoice, status.

        It sits above the existing card rather than replacing it, because the
        card carries the processor-specific routes out — the Stripe portal,
        the PayPal link, the contact-support fallback — and each of those is
        the only cancellation path for its case. Tiles answer "what am I on
        and what happens next" at a glance; the card answers "how do I change
        it".

        Only rendered for a real subscription. Three empty tiles above a
        plan picker would be furniture telling somebody who has not bought
        anything that they are on no plan, which they know.
      */}
      {subscription ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="size-3.5" aria-hidden="true" />
              {t.currentPlan}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight">
              {subscription.planName ?? "—"}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" aria-hidden="true" />
              {subscription.cancelAtPeriodEnd ? t.accessEnds : t.nextInvoice}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight">
              {subscription.currentPeriodEnd
                ? formatDate(subscription.currentPeriodEnd, locale, {
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {t.status}
            </p>
            {/*
              The raw status, title-cased — not a friendlier word of our own.
              "past_due" means a payment failed and the customer needs to act;
              softening it to "Active" would hide the one state worth seeing.
            */}
            <p className="mt-2 text-xl font-semibold tracking-tight capitalize">
              {subscription.status.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      ) : null}

      {/*
        The action row from the design: pause, cancel, manage.

        All three open the Stripe portal — pause and manage on its home screen,
        cancel deep-linked to its cancellation flow. Nothing here changes a
        subscription directly: the portal owns proration, tax and dunning, and
        every change there emits the webhook that updates our own row. A local
        "paused" flag set by a button press would be a second source of truth
        that Stripe never agreed to.

        Shown only for a Stripe subscription with a customer. PayPal keeps its
        own route out further down the page, and a workspace with no customer
        has nothing to pause or cancel.
      */}
      {subscription?.hasCustomer ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handlePortal("manage")}
            disabled={portalPending !== null}
          >
            <PauseCircle className="size-4" aria-hidden="true" />
            {portalPending === "manage" ? "Opening…" : "Pause billing"}
          </Button>

          {/*
            Destructive styling without a destructive <Button variant>: this
            opens Stripe's confirmation screen rather than cancelling, so it
            should read as serious without claiming the click itself ends the
            subscription.
          */}
          <Button
            variant="outline"
            onClick={() => handlePortal("cancel")}
            disabled={portalPending !== null}
            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            {portalPending === "cancel" ? "Opening…" : "Cancel subscription"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => handlePortal("manage")}
            disabled={portalPending !== null}
          >
            {tCommon.manageBilling}
            <ExternalLink className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {/*
        The upgrade strip from the design.

        Only for a subscriber who is NOT already on the top tier — the whole
        point is the gap between what they have and what they could have, and
        showing "ready to scale?" to somebody already on Scale is the kind of
        detail that makes a product feel like it is not paying attention.

        The copy names real differences read from the plan rows rather than a
        fixed sentence, so it cannot drift away from what the tiers actually
        include when the limits change.
      */}
      {upgradeTarget ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Ready to scale? {upgradeTarget.articleLimit} articles a month,{" "}
            {formatNumber(upgradeTarget.keywordLimit, locale)} search terms tracked
            and {upgradeTarget.monthlyCredits} link credits — all in the{" "}
            {upgradeTarget.name} plan.
          </p>
          <Button variant="link" className="h-auto p-0" asChild>
            <a href="#plans">
              See what {upgradeTarget.name} offers
              <ChevronRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t.currentPlan}
            {subscription?.status ? (
              <Badge variant={entitled ? "default" : "destructive"}>
                {subscription.status.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {subscription?.planName
              ? t.onPlan(subscription.planName)
              : t.noSubscription}
          </CardDescription>
        </CardHeader>

        {subscription?.currentPeriodEnd ? (
          <CardContent className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? t.accessEndsOn(formatDate(subscription.currentPeriodEnd, locale))
              : t.renewsOn(formatDate(subscription.currentPeriodEnd, locale))}
          </CardContent>
        ) : null}

        {subscription?.hasCustomer ? (
          /*
            The portal route also lives in the action row above. Kept here so
            the card that explains the plan still carries the way to change
            it — the two are one click apart and both land in the same place.
          */
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => handlePortal("manage")}
              disabled={portalPending !== null}
            >
              {portalPending === "manage" ? "Opening…" : "Manage billing"}
              <ExternalLink className="size-4" />
            </Button>
          </CardFooter>
        ) : subscription?.provider === "paypal" ? (
          /**
           * PayPal has no portal API we can open on the customer's behalf, so
           * this points at where their subscription and receipts actually live.
           * Without it a PayPal subscriber has no route to an invoice or a
           * cancellation at all: the Stripe button above never applies to them,
           * because they have no Stripe customer.
           */
          <CardFooter className="flex-col items-start gap-2">
            <Button variant="outline" asChild>
              <a
                href="https://www.paypal.com/myaccount/autopay/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {tCommon.manageInPayPal}
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              {t.paypalReceipts}
            </p>
          </CardFooter>
        ) : subscription && isEntitled(subscription.status) ? (
          /**
           * Entitled, but with no processor record to send them to — a
           * subscription granted by hand, or one whose webhook never linked a
           * customer. Rare, but silence here reads as "there is no way to
           * cancel", so it points at a human instead of showing nothing.
           */
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              This subscription is managed for you. Contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              for receipts or to make a change.
            </p>
          </CardFooter>
        ) : null}
      </Card>

      {/*
        Anchor for the upgrade strip above. scroll-mt clears the sticky header,
        which would otherwise sit over the interval tabs the reader was sent to.
      */}
      <div id="plans" className="scroll-mt-20" />

      {hasAnnual ? (
        <Tabs
          value={interval}
          onValueChange={(v) => setInterval(v as "month" | "year")}
        >
          <TabsList>
            <TabsTrigger value="month">{t.monthly}</TabsTrigger>
            <TabsTrigger value="year">{t.annual}</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {/* Four tiers since Starter: two up at tablet width, four across on desktop. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((plan) => {
          const isCurrent = subscription?.planId === plan.id && entitled;
          const saving =
            plan.interval === "year"
              ? annualSaving(monthlyByTier.get(plan.tier), plan)
              : 0;

          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {plan.name}
                  {/*
                    Starter is the lead-in from the brief, not simply the
                    weakest plan on the row.
                  */}
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
                      Save {saving}%
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">
                    {formatPrice(plan.priceCents, plan.currency)}
                  </span>
                  <span className="text-muted-foreground">
                    {plan.interval === "year" ? " / year" : " / month"}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  {planFeatures(plan, t, locale).map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-muted-foreground" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <div className="w-full space-y-2">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || pendingPlanId !== null}
                    onClick={() => handleSelect(plan.id)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : pendingPlanId === plan.id
                        ? "Redirecting…"
                        : entitled
                          ? "Switch to this plan"
                          : "Pay by card"}
                  </Button>

                  {/* Only rendered once PayPal credentials exist, so the
                      customer is never offered a route that cannot complete. */}
                  {paypalAvailable && !isCurrent ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={pendingPlanId !== null}
                      onClick={() => handlePayPal(plan.id)}
                    >
                      {tCommon.payWithPayPal}
                    </Button>
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {paypalAvailable ? (
        <p className="text-center text-xs text-muted-foreground">
          {tCommon.promoCodesHelp}
          </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tCommon.noPlans}
        </p>
      ) : null}
    </PageShell>
  );
}
