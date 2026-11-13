import { CommissionList } from "@/components/partners/dashboard-views";
import { PortalPager } from "@/components/partners/portal-ui";
import { partnerCommissionHistory } from "@/lib/partners/application/queries/partner-dashboard";
import { commissionRowView, pagerView } from "@/lib/partners/presentation/views";
import { partnerDeps } from "@/lib/partners/server";

import { pageParam, requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.commissions.title };
}

/** One line per commissionable payment; amounts in the currency the customer paid. */
export default async function PartnerCommissionsPage({ searchParams }: PageProps<"/partner/commissions">) {
  const { access, copy, locale } = await requirePartnerPage();
  const page = pageParam((await searchParams).page);
  const history = await partnerCommissionHistory(partnerDeps(), access.context, { page });
  const t = copy.portal;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.commissions.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.commissions.intro}</p>
      </div>
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <CommissionList copy={t} rows={history.rows.map((row) => commissionRowView(row, t, locale))} />
        <PortalPager basePath="/partner/commissions" pager={pagerView(history, t)} />
      </div>
    </div>
  );
}
