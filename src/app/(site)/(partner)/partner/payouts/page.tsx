import { PayoutList } from "@/components/partners/dashboard-views";
import { PayoutStatus } from "@/components/partners/payout-status";
import { PortalPager } from "@/components/partners/portal-ui";
import { localePath } from "@/lib/i18n/config";
import { partnerPayoutHistory } from "@/lib/partners/application/queries/partner-dashboard";
import { partnerPayoutStatus } from "@/lib/partners/application/queries/payout-status";
import { PAYOUT_STATUS_COPY } from "@/lib/partners/presentation/payout-status-copy";
import { pagerView, payoutRowView, payoutStatusView } from "@/lib/partners/presentation/views";
import { partnerDeps } from "@/lib/partners/server";

import { pageParam, requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.payouts.title };
}

/** How and when this partner is paid, then each payout: Stripe's in its two steps, PayPal's and credits' in one. */
export default async function PartnerPayoutsPage({ searchParams }: PageProps<"/partner/payouts">) {
  const { access, copy, locale } = await requirePartnerPage();
  const page = pageParam((await searchParams).page);
  const deps = partnerDeps();
  const [history, status] = await Promise.all([partnerPayoutHistory(deps, access.context, { page }), partnerPayoutStatus(deps, access.partner)]);
  const t = copy.portal;
  const payoutCopy = PAYOUT_STATUS_COPY[locale];
  // Stripe's own wording only while every payout listed went, or will go, through Stripe.
  const stripeOnly = status.form === "cash" && !status.step.startsWith("paypal") && history.rows.every((row) => row.method === "stripe");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.payouts.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{status.form === "credits" ? payoutCopy.payouts.introCredits : stripeOnly ? t.payouts.intro : payoutCopy.payouts.introCash}</p>
        {status.form === "cash" ? <p className="mt-1 text-sm text-muted-foreground">{t.payouts.schedule}</p> : null}
      </div>
      <PayoutStatus view={payoutStatusView(status, payoutCopy, locale)} contactHref={localePath(locale, "/contact")} />
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <PayoutList
          copy={t}
          rows={history.rows.map((row) => payoutRowView(row, t, locale, payoutCopy.payouts))}
          columns={stripeOnly ? undefined : { sent: payoutCopy.payouts.sent, received: payoutCopy.payouts.received }}
        />
        <PortalPager basePath="/partner/payouts" pager={pagerView(history, t)} />
      </div>
    </div>
  );
}
