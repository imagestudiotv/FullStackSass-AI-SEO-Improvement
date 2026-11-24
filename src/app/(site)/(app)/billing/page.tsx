import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

import { PurchasesPanel } from "@/components/billing/purchases-panel";
import { PayPalPendingNotice } from "@/components/paypal-pending-notice";
import { PayPalPlanChangeNotice } from "@/components/paypal-plan-change-notice";
import { SettingsNav } from "@/components/settings-nav";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { listAddons, listPurchases } from "@/lib/addons/actions";
import { requireSession } from "@/lib/auth-guard";
import {
  getSubscription,
  isEntitled,
  listPayments,
  listPlans,
  listWebsiteSubscriptions,
  type PaymentRow,
} from "@/lib/billing";
import { hasUnfinishedPayPalApproval, isTrialEligible, planScreenOffer } from "@/lib/billing/checkouts";
import { onLaunchPrice } from "@/lib/billing/launch-price";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { ADDON_SERVICES_HREF } from "@/lib/credits/buy-credits";
import { QUOTE_CREDITS_SLUG } from "@/lib/credits/quote-topup-shared";
import { db } from "@/lib/db";
import { billingCustomers, websites } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { OFFER_CODE, WINBACK_OFFER_CODE } from "@/lib/i18n/offer-code";
import { PAYPAL_PENDING_COPY } from "@/lib/i18n/paypal-pending";
import { PAYPAL_PLAN_CHANGE_COPY } from "@/lib/i18n/paypal-plan-change";
import { planChangeNoticeForWebsite } from "@/lib/paypal/plan-changes";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { localisedWebsiteProjectName, WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { websiteProjectKindOf, websiteProjectsHref } from "@/lib/website-projects/shared";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork, listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";
import { format } from "@/lib/i18n/format";
import { freePlanCopy } from "@/lib/i18n/free-plan";
import { freePlanValues } from "@/lib/plans/free-plan";
import { isFreePlanWebsite } from "@/lib/plans/free-plan-server";

import { BillingClient } from "./billing-client";
import { lacksCardInvoice, packsReturnPath, paymentOptions, selectedPlanOf, type InvoicePortal } from "./billing-view";
import { PaymentsPanel } from "./payments-panel";
import { planCardsFor } from "./plan-cards";

/** One read of the reader's language per request, shared by the title and the page. */
const messagesFor = cache((userId: string) => getAppMessages(userId));

/**
 * Where the billing history sends someone for a card invoice the webhook
 * recorded without a link: the plan section's own "Manage billing" when it is
 * there, otherwise a button in the history itself - or nowhere, without a
 * Stripe customer. The customer (one row) is read only when the plan section
 * lacks the button AND such a payment is listed, which is rare.
 */
async function invoicePortal(
  orgId: string,
  payments: PaymentRow[],
  portalOnPage: boolean,
): Promise<InvoicePortal> {
  if (portalOnPage) return "page";
  if (!payments.some(lacksCardInvoice)) return "none";
  const [customer] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, orgId))
    .limit(1);
  return customer?.id ? "here" : "none";
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { t } = await messagesFor(session.user.id);
  return { title: t.app.billing.title };
}

// Subscription state changes via webhook; never serve a cached view of it.
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const params = await searchParams;

  // The credit packs, and a quote's credits, have their own page since 2026-11-24; an older address goes on to it.
  const packs = packsReturnPath(params);
  if (packs) redirect(packs);

  /**
   * The website a new plan would pay for: the one the switcher is on,
   * resolved exactly as the sidebar does so the two agree - among the sites
   * THIS workspace owns. A site shared with this person is billed by its
   * owner and is never described here.
   */
  const owned = await db
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(websites.createdAt);
  const websiteSubscriptions = await listWebsiteSubscriptions(orgId);
  const remembered = await readSelectedWebsite();

  /**
   * ?site= wins over the remembered choice.
   *
   * Setup sends someone here to pay for ONE website - the one they just
   * added - and the switcher may still point at an older one. resolveWebsiteId
   * checks it against what the workspace owns, so an id from elsewhere falls
   * through to the remembered choice rather than selecting anything.
   */
  const siteParam = typeof params.site === "string" ? params.site : null;
  const websiteId = resolveWebsiteId(
    siteParam,
    remembered,
    owned.map((site) => site.id),
  );

  /*
    Whose website the header is on, and whether this person came only for
    somebody else's. Both read the request-cached list the layout already
    loaded, so they cost no extra query for an owner.

    Someone who owns no website but works on a shared one has nothing to pay
    for here: the owner pays. They used to get a plan picker whose buttons all
    said "add a website first" and an add-on shop that sold credits into an
    empty workspace.
  */
  const accessible = await listAccessibleWebsites();
  const guestOnly = await hasOnlySharedWork();
  const headerSiteId = resolveWebsiteId(
    null,
    remembered,
    accessible.map((site) => site.id),
  );
  const headerSite = accessible.find((site) => site.id === headerSiteId) ?? null;
  const viewingSharedDomain =
    headerSite && headerSite.access !== "owner" ? headerSite.domain : null;

  const checkout = typeof params.checkout === "string" ? params.checkout : undefined;
  const paypalResult = typeof params.paypal === "string" ? params.paypal : undefined;
  const { locale, t } = await messagesFor(session.user.id);

  if (guestOnly) {
    // Only what is theirs to see: any past purchases and payments of their own workspace.
    const [purchases, paymentRows] = await Promise.all([listPurchases(), listPayments(orgId)]);
    const portal = await invoicePortal(orgId, paymentRows, false);
    return (
      <PageShell width="wide">
        <PageHeader title={t.app.billing.title} />
        <EmptyState
          icon={Users}
          title={t.app.billing.guestTitle}
          description={t.app.billing.guestBody}
          className="bg-card"
        />
        <PurchasesPanel
          purchases={purchases.map((purchase) => localisedWebsiteProjectName(purchase, locale))}
          locale={locale}
          t={t.app.addons}
          tCredits={t.app.credits}
        />
        <PaymentsPanel
          payments={paymentRows}
          portal={portal}
          t={t.app.common}
          tBilling={t.app.billing}
          tStatus={t.app.status}
          locale={locale}
        />
      </PageShell>
    );
  }

  const planChangeResult = typeof params.plan_change === "string" ? params.plan_change : undefined;
  const [plans, subscription, paypalAvailable, addons, purchases, paymentRows, unfinishedPayPal, planChange] = await Promise.all([
    listPlans(),
    getSubscription(orgId),
    isPayPalAvailable(),
    listAddons(),
    listPurchases(),
    listPayments(orgId),
    // A PayPal payment started and never finished blocks this website (review H1): offer to cancel it.
    websiteId ? hasUnfinishedPayPalApproval(db, { organizationId: orgId, websiteId }) : false,
    // A PayPal plan change under way (review P1): a payment or an approval still to give, or a downgrade's date.
    websiteId ? planChangeNoticeForWebsite(orgId, websiteId) : null,
  ]);

  /*
    What the page describes and acts on: the SELECTED website's subscription.
    Each website is billed separately, and describing the workspace's
    "first" subscription here labelled another site's plan "Current plan" -
    and "Switch to this plan" then bought a second subscription.
  */
  const selected = websiteId
    ? websiteSubscriptions.find((row) => row.websiteId === websiteId)
    : undefined;
  const current = selected ? (selected.planId ? selected : null) : subscription;
  // The same decision BillingClient makes for its plan footer, from the same data.
  const portal = await invoicePortal(
    orgId,
    paymentRows,
    paymentOptions(current, paypalAvailable).manageInStripe,
  );
  // The discount checkout applies by itself, said on screen: REPGET, else the win-back offer (lib/billing/winback-offer.ts).
  const screenOffer = await planScreenOffer(db, orgId);
  const freeHere = websiteId ? await isFreePlanWebsite(websiteId) : false;
  const freeWords = freePlanCopy(locale).app;

  /*
    A plan change - rather than a new checkout - takes no new discount: it
    keeps the launch price a subscription already has, or has none. So the
    prices it would really be billed at are shown. (Choosing a plan during a
    PayPal free trial is a new checkout: beginCheckout.)
  */
  const entitled = isEntitled(current?.status);
  const switching = entitled && !(current?.provider === "paypal" && current.status === "trialing");
  const launchPrice = switching && websiteId ? await onLaunchPrice(db, websiteId) : false;

  /*
    The plan cards' prices, terms and benefits (plan-cards.ts): the price
    checkout charges, struck against the regular one only where checkout
    really discounts it, and the free articles only where checkout gives them.
  */
  const planCards = planCardsFor(plans, {
    offerOn: repgetOfferEnabled(),
    trialEligible: await isTrialEligible(db, orgId),
    switching,
    launchPrice,
    locale,
    t: t.app.billing,
  });

  const quoteTitle = QUOTE_CREDITS_COPY[locale].title;
  // A quote's credits are one purchase among the packs: named as such, in the reader's language.
  const purchaseRows = purchases.map((purchase) =>
    purchase.slug === QUOTE_CREDITS_SLUG ? { ...purchase, name: quoteTitle } : localisedWebsiteProjectName(purchase, locale),
  );

  return (
    /*
      Wide, like the website pages, so the settings strip keeps one width
      from tab to tab; and one shell, so the strip and the title get the same
      space-y-6 rhythm as everywhere else (they used to touch).
    */
    <PageShell width="wide">
      {/*
        The five-section strip, rendered only with a website: the per-website
        tabs have nowhere to point without one. No `access`: the site here is
        always one this workspace owns.
      */}
      {websiteId ? <SettingsNav websiteId={websiteId} t={t.app.nav} /> : null}

      {websiteId && unfinishedPayPal ? <PayPalPendingNotice websiteId={websiteId} copy={PAYPAL_PENDING_COPY[locale]} /> : null}

      <PayPalPlanChangeNotice notice={planChange} result={planChangeResult} copy={PAYPAL_PLAN_CHANGE_COPY[locale]} locale={locale} />

      {/* The Free plan (lib/plans/free-plan.ts): what this website has, above the plans to upgrade to. No button: the plans are right below. */}
      {freeHere ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{format(freeWords.onFree, freePlanValues(locale))}</p>
          <p className="text-xs text-muted-foreground">{format(freeWords.trialHint, freePlanValues(locale))}</p>
        </div>
      ) : null}

      <BillingClient
        plans={plans}
        subscription={current}
        entitled={entitled}
        paypalAvailable={paypalAvailable}
        offerCopy={switching ? null : screenOffer === "repget" ? OFFER_CODE[locale] : screenOffer === "winback" ? WINBACK_OFFER_CODE[locale] : null}
        launchPriceKept={launchPrice}
        paypalIntervalNote={PAYPAL_PLAN_CHANGE_COPY[locale].intervalSwitch}
        paypalPendingCopy={PAYPAL_PENDING_COPY[locale]}
        checkout={checkout}
        paypalResult={paypalResult}
        websiteId={websiteId}
        websiteSubscriptions={websiteSubscriptions}
        viewingSharedDomain={viewingSharedDomain}
        t={t.app.billing}
        locale={locale}
        tCommon={t.app.common}
        planCards={planCards}
        selectedPlan={selectedPlanOf(params, plans)}
        addonLinks={addons
          .filter((addon) => addon.kind !== "credits")
          .map((addon) => {
            // These two are named in the reader's language, and have their own screen.
            const kind = websiteProjectKindOf(addon.slug);
            return kind
              ? { id: addon.id, name: WEBSITE_PROJECT_COPY[locale].addons[kind].name, href: websiteProjectsHref(kind) }
              : { id: addon.id, name: addon.name, href: ADDON_SERVICES_HREF };
          })}
      />

      <PurchasesPanel purchases={purchaseRows} locale={locale} t={t.app.addons} tCredits={t.app.credits} />

      <PaymentsPanel
        payments={paymentRows}
        portal={portal}
        t={t.app.common}
        tBilling={t.app.billing}
        tStatus={t.app.status}
        locale={locale}
      />
    </PageShell>
  );
}
