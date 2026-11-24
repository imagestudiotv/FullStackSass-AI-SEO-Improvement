import { Coins, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PurchasesPanel } from "@/components/billing/purchases-panel";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import { listAddons, listPurchases } from "@/lib/addons/actions";
import { requireSession } from "@/lib/auth-guard";
import { creditOverview } from "@/lib/credits/overview";
import { checkQuoteTopUp } from "@/lib/credits/quote-topup";
import { QUOTE_CREDITS_SLUG } from "@/lib/credits/quote-topup-shared";
import { db } from "@/lib/db";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { BUY_CREDITS_COPY, PAYMENT_CHOICE_COPY } from "@/lib/i18n/buy-credits";
import { format, plural } from "@/lib/i18n/format";
import { PAYPAL_PURCHASE_COPY } from "@/lib/i18n/paypal-purchase";
import { QUOTE_CREDITS_COPY } from "@/lib/i18n/quote-credits";
import { localisedWebsiteProjectName, WEBSITE_PROJECT_COPY } from "@/lib/i18n/website-projects";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { requireOrg } from "@/lib/tenant";
import { websiteProjectKindOf } from "@/lib/website-projects/shared";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { CreditPacks, type AddonReturn } from "./credit-packs";
import { QuoteCreditsCard } from "./quote-credits-card";
import { ServicesPanel } from "./services-panel";

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { locale } = await getAppMessages(session.user.id);
  return { title: BUY_CREDITS_COPY[locale].title };
}

// The balance and the purchases move with every payment; never serve a cached view of them.
export const dynamic = "force-dynamic";

const RETURNS: readonly AddonReturn[] = ["success", "pending", "failed", "cancelled"];

/**
 * Credits for money, the packs first (Daniel, 2026-11-24: "We want to move
 * credit packs at first glance for buying credits option"): every "Buy
 * credits" leads here. Under them the services bought with credits, and what
 * this workspace has bought. Both checkouts, by card and by PayPal, come back
 * here (lib/addons/actions.ts, app/api/paypal/orders/return).
 */
export default async function BuyCreditsPage({ searchParams }: PageProps<"/credits/buy">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { t, locale } = await getAppMessages(session.user.id);
  const copy = BUY_CREDITS_COPY[locale];
  const quoteCopy = QUOTE_CREDITS_COPY[locale];
  // A quote's credits are one purchase among the packs: named as such, in the reader's language.
  const named = (rows: Awaited<ReturnType<typeof listPurchases>>) =>
    rows.map((purchase) =>
      purchase.slug === QUOTE_CREDITS_SLUG ? { ...purchase, name: quoteCopy.title } : localisedWebsiteProjectName(purchase, locale),
    );

  /*
    Someone who owns no website and works on a shared one has no site to spend
    credits on, and the owner pays: no shop for them, as the sidebar hides
    Add-ons. Their own past purchases, if any, still show.
  */
  if (await hasOnlySharedWork()) {
    return (
      <PageShell>
        <PageHeader title={copy.title} />
        <Notice>{t.app.credits.guestOnly}</Notice>
        <PurchasesPanel purchases={named(await listPurchases())} locale={locale} t={t.app.addons} tCredits={t.app.credits} />
      </PageShell>
    );
  }

  const params = await searchParams;
  const result = RETURNS.find((value) => value === params.addon) ?? null;

  // The overview first: it grants this month's plan credits, so the balance includes them.
  const overview = await creditOverview(orgId);
  const [addons, purchases, paypalAvailable] = await Promise.all([listAddons(), listPurchases(), isPayPalAvailable()]);

  /*
    "Buy credits" on a quote (lib/credits/quote-topup.ts): the quote and its
    revision in the address, checked here in this workspace and priced by the
    server; the card above the packs says what is missing and what it costs.
  */
  const projectId = typeof params.project === "string" ? params.project : null;
  const revision = typeof params.revision === "string" ? params.revision : null;
  const quote =
    projectId && revision ? await checkQuoteTopUp(db, { organizationId: orgId, projectId, revision }) : null;

  const services = addons.map((addon) => {
    // These two are named in the reader's language.
    const kind = websiteProjectKindOf(addon.slug);
    return kind ? { ...addon, ...WEBSITE_PROJECT_COPY[locale].addons[kind] } : addon;
  });
  const paypalCopy = PAYPAL_PURCHASE_COPY[locale];

  return (
    <PageShell>
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        actions={
          <>
            <Link
              href="/credits"
              className="inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-sm font-semibold tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Coins className="size-4 text-primary" aria-hidden="true" />
              {format(copy.balance, { balance: plural(t.app.credits.creditsCount, overview.available) })}
            </Link>
            <Button asChild variant="outline">
              <Link href="/billing">
                <CreditCard aria-hidden="true" />
                {copy.billingLink}
              </Link>
            </Button>
          </>
        }
      />

      {quote && projectId ? (
        <QuoteCreditsCard
          check={quote}
          projectId={projectId}
          kindLabel={quote.ok ? WEBSITE_PROJECT_COPY[locale].kind[quote.offer.kind] : null}
          copy={quoteCopy}
          locale={locale}
          paypalAvailable={paypalAvailable}
        />
      ) : null}

      <CreditPacks
        addons={addons}
        paypalAvailable={paypalAvailable}
        result={result}
        resultCopy={{
          success: t.app.billing.purchaseReceived,
          cancelled: t.app.billing.purchaseCancelled,
          pending: paypalCopy.pending,
          failed: paypalCopy.failed,
        }}
        copy={copy}
        choice={PAYMENT_CHOICE_COPY[locale]}
        locale={locale}
        tAddons={t.app.addons}
        mostPopular={t.app.common.mostPopular}
      />

      <ServicesPanel addons={services} t={t.app.addons} tCredits={t.app.credits} />

      <PurchasesPanel purchases={named(purchases)} locale={locale} t={t.app.addons} tCredits={t.app.credits} />
    </PageShell>
  );
}
