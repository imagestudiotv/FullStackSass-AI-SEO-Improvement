import { ReferralList } from "@/components/partners/dashboard-views";
import { PortalPager } from "@/components/partners/portal-ui";
import { partnerReferrals } from "@/lib/partners/application/queries/partner-dashboard";
import { pagerView, referralRowView } from "@/lib/partners/presentation/views";
import { partnerDeps } from "@/lib/partners/server";

import { pageParam, requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.referrals.title };
}

/** Workspaces attributed to the partner, shown by privacy-safe labels only. */
export default async function PartnerReferralsPage({ searchParams }: PageProps<"/partner/referrals">) {
  const { access, copy, locale } = await requirePartnerPage();
  const page = pageParam((await searchParams).page);
  const referrals = await partnerReferrals(partnerDeps(), access.context, { page });
  const t = copy.portal;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.referrals.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.referrals.intro}</p>
      </div>
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <ReferralList copy={t} rows={referrals.rows.map((row) => referralRowView(row, t, locale))} />
        <PortalPager basePath="/partner/referrals" pager={pagerView(referrals, t)} />
      </div>
    </div>
  );
}
