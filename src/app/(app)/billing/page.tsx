import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { cache } from "react";

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
import { db } from "@/lib/db";
import { billingCustomers, websites } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork, listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

import { AddonsPanel } from "./addons-panel";
import { BillingClient } from "./billing-client";
import { lacksCardInvoice, paymentOptions, type InvoicePortal } from "./billing-view";
import { PaymentsPanel } from "./payments-panel";

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
          purchases={purchases}
          canBuy={false}
          locale={locale}
          t={t.app.addons}
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

  const [plans, subscription, paypalAvailable, addons, purchases, paymentRows] = await Promise.all([
    listPlans(),
    getSubscription(orgId),
    isPayPalAvailable(),
    listAddons(),
    listPurchases(),
    listPayments(orgId),
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

      <BillingClient
        plans={plans}
        subscription={current}
        entitled={isEntitled(current?.status)}
        paypalAvailable={paypalAvailable}
        checkout={checkout}
        addonResult={addonResult}
        paypalResult={paypalResult}
        websiteId={websiteId}
        websiteSubscriptions={websiteSubscriptions}
        viewingSharedDomain={viewingSharedDomain}
        t={t.app.billing}
        locale={locale}
        tCommon={t.app.common}
      />

      {/*
        Below the plans: an add-on is bought in addition to a subscription, so
        it should not compete with choosing one. The section carries
        id="addons", the target of the sidebar's Add-ons links.
      */}
      <AddonsPanel
        addons={addons}
        purchases={purchases}
        canBuy
        locale={locale}
        t={t.app.addons}
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
