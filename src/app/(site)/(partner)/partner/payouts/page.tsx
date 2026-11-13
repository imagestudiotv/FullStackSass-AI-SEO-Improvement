import { PayoutList } from "@/components/partners/dashboard-views";
import { PortalPager } from "@/components/partners/portal-ui";
import { partnerPayoutHistory } from "@/lib/partners/application/queries/partner-dashboard";
import { pagerView, payoutRowView } from "@/lib/partners/presentation/views";
import { partnerDeps } from "@/lib/partners/server";

import { pageParam, requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.payouts.title };
}

/** Each payout in its two steps: to the partner's Stripe balance, then to their bank. */
export default async function PartnerPayoutsPage({ searchParams }: PageProps<"/partner/payouts">) {
  const { access, copy, locale } = await requirePartnerPage();
  const page = pageParam((await searchParams).page);
  const history = await partnerPayoutHistory(partnerDeps(), access.context, { page });
  const t = copy.portal;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.payouts.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.payouts.intro}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.payouts.schedule}</p>
      </div>
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <PayoutList copy={t} rows={history.rows.map((row) => payoutRowView(row, t, locale))} />
        <PortalPager basePath="/partner/payouts" pager={pagerView(history, t)} />
      </div>
    </div>
  );
}
