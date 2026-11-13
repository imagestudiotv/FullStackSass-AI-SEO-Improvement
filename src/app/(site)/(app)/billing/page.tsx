import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { cache } from "react";

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
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { checkQuoteTopUp } from "@/lib/credits/quote-topup";
import { QUOTE_CREDITS_SLUG } from "@/lib/credits/quote-topup-shared";
import { db } from "@/lib/db";
import { billingCustomers, websites } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { OFFER_CODE, WINBACK_OFFER_CODE } from "@/lib/i18n/offer-code";
import { PAYPAL_PENDING_COPY } from "@/lib/i18n/paypal-pending";
import { PAYPAL_PLAN_CHANGE_COPY } from "@/lib/i18n/paypal-plan-change";
import { planChangeNoticeForWebsite } from "@/lib/paypal/plan-changes";
import { PAYPAL_PURCHASE_COPY } from "@/lib/i18n/paypal-purchase";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { localisedWebsiteProjectName, WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { websiteProjectKindOf } from "@/lib/website-projects/shared";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork, listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

import { AddonsPanel } from "./addons-panel";
import { BillingClient } from "./billing-client";
import { lacksCardInvoice, paymentOptions, type InvoicePortal } from "./billing-view";
import { PaymentsPanel } from "./payments-panel";
import { planCardsFor } from "./plan-cards";
import { QuoteCreditsCard } from "./quote-credits-card";

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
  const params = await searchParams;
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
  const addonResult = typeof params.addon === "string" ? params.addon : undefined;
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
        <AddonsPanel
          addons={[]}
          purchases={purchases.map((purchase) => localisedWebsiteProjectName(purchase, locale))}
          canBuy={false}
          locale={locale}
          t={t.app.addons}
          tCredits={t.app.credits}
          tCommon={t.app.common}
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

  /*
    The plan cards' prices, terms and benefits (plan-cards.ts): the price
    checkout charges, struck against the regular one only where checkout
    really discounts it, and the free articles only where checkout gives them.
  */
  const planCards = planCardsFor(plans, {
    offerOn: repgetOfferEnabled(),
    trialEligible: await isTrialEligible(db, orgId),
    switching: isEntitled(current?.status),
    locale,
    t: t.app.billing,
  });

  /*
    "Buy credits" on a quote (lib/credits/quote-topup.ts): the quote and its
    revision in the address, checked here in this workspace and priced by the
    server; the card at the top says what is missing and what it costs.
  */
  const quoteProject = typeof params.project === "string" ? params.project : null;
  const quoteRevision = typeof params.revision === "string" ? params.revision : null;
  const quoteCheck =
    quoteProject && quoteRevision
      ? await checkQuoteTopUp(db, { organizationId: orgId, projectId: quoteProject, revision: quoteRevision })
      : null;
  const quoteCopy = QUOTE_CREDITS_COPY[locale];
  const quoteCard =
    quoteProject && quoteCheck ? (
      <QuoteCreditsCard
        check={quoteCheck}
        projectId={quoteProject}
        kindLabel={quoteCheck.ok ? WEBSITE_PROJECT_COPY[locale].kind[quoteCheck.offer.kind] : null}
        copy={quoteCopy}
        locale={locale}
        paypalAvailable={paypalAvailable}
      />
    ) : null;
  // A quote's credits are one purchase among the packs: named as such, in the reader's language.
  const purchaseRows = purchases.map((purchase) =>
    purchase.slug === QUOTE_CREDITS_SLUG ? { ...purchase, name: quoteCopy.title } : localisedWebsiteProjectName(purchase, locale),
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

      <BillingClient
        plans={plans}
        subscription={current}
        entitled={isEntitled(current?.status)}
        paypalAvailable={paypalAvailable}
        offerCopy={screenOffer === "repget" ? OFFER_CODE[locale] : screenOffer === "winback" ? WINBACK_OFFER_CODE[locale] : null}
        paypalIntervalNote={PAYPAL_PLAN_CHANGE_COPY[locale].intervalSwitch}
        checkout={checkout}
        addonResult={addonResult}
        addonPayPalCopy={PAYPAL_PURCHASE_COPY[locale]}
        paypalResult={paypalResult}
        websiteId={websiteId}
        websiteSubscriptions={websiteSubscriptions}
        viewingSharedDomain={viewingSharedDomain}
        t={t.app.billing}
        locale={locale}
        tCommon={t.app.common}
        planCards={planCards}
        top={quoteCard}
      />

      {/*
        Below the plans: an add-on is bought in addition to a subscription, so
        it should not compete with choosing one. The section carries
        id="addons", the target of the sidebar's Add-ons links.
      */}
      <AddonsPanel
        addons={addons.map((addon) => {
          // These two are named in the reader's language.
          const kind = websiteProjectKindOf(addon.slug);
          return kind ? { ...addon, ...WEBSITE_PROJECT_COPY[locale].addons[kind] } : addon;
        })}
        purchases={purchaseRows}
        canBuy
        locale={locale}
        t={t.app.addons}
        tCredits={t.app.credits}
        tCommon={t.app.common}
        paypal={paypalAvailable ? PAYPAL_PURCHASE_COPY[locale] : null}
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
