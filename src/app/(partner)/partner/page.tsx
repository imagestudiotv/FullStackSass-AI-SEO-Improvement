import { AlertTriangle, PauseCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CouponsPanel, EarningsPanel, MetricsPanel } from "@/components/partners/dashboard-views";
import { ReferralLink } from "@/components/partners/referral-link";
import { TierProgress } from "@/components/partners/tier-progress";
import { METRIC_RANGES, partnerDashboard, type MetricRange } from "@/lib/partners/application/queries/partner-dashboard";
import { fill } from "@/lib/partners/presentation/copy";
import { rateLabel } from "@/lib/partners/presentation/format";
import { balanceView, couponView, formatPortalDate, metricsView } from "@/lib/partners/presentation/views";
import { partnerDeps } from "@/lib/partners/server";

import { requirePartnerPage } from "./portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.overview.title };
}

function rangeFrom(value: string | string[] | undefined): MetricRange {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (METRIC_RANGES as readonly number[]).includes(days) ? (days as MetricRange) : 30;
}

export default async function PartnerOverviewPage({ searchParams }: PageProps<"/partner">) {
  const { access, copy, locale } = await requirePartnerPage();
  const days = rangeFrom((await searchParams).range);
  const overview = await partnerDashboard(partnerDeps(), access.context, { days });
  if (!overview) notFound();
  const t = copy.portal;
  const { progress, partner, policy } = overview;
  const remaining = progress.next
    ? fill(t.overview.remaining, { count: progress.remaining, tier: progress.next.name, rate: rateLabel(progress.next.rateBasisPoints) })
    : t.overview.topTier;
  const ranges = METRIC_RANGES.map((range) => ({
    days: range,
    href: range === 30 ? "/partner" : `/partner?range=${range}`,
    current: range === days,
    label: fill(t.overview.metrics.range, { days: range }),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.overview.title}</h1>

      {partner.status === "suspended" ? (
        <Banner icon={AlertTriangle} title={t.suspended.title} body={t.suspended.body} />
      ) : partner.payoutHoldReason ? (
        <Banner icon={PauseCircle} title={t.hold.title} body={t.hold.body} />
      ) : null}

      <section className="rounded-xl border bg-card p-4 sm:p-6" aria-labelledby="link-title">
        <h2 id="link-title" className="font-semibold">{t.overview.linkTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{fill(t.overview.linkHint, { days: policy.attributionWindowDays })}</p>
        <div className="mt-4">
          <ReferralLink url={overview.referralUrl} label={t.overview.linkTitle} copyLabel={t.overview.copy} copiedLabel={t.overview.copied} />
        </div>
      </section>

      <EarningsPanel
        copy={t}
        balances={overview.balances.map((balance) => balanceView(balance, t, locale, policy.maturityDays))}
        nextPayout={fill(t.overview.nextPayout, { date: formatPortalDate(overview.nextPayoutAt, locale) })}
      />

      <MetricsPanel copy={t} metrics={metricsView(overview.metrics, t, locale)} ranges={ranges} />

      <div className="grid gap-6 md:grid-cols-2">
        <TierProgress
          title={t.overview.tierTitle}
          tierName={progress.current.name}
          rate={rateLabel(progress.current.rateBasisPoints)}
          progressLabel={fill(t.overview.progress, { count: progress.customers, target: progress.next?.minCustomers ?? progress.customers })}
          remainingLabel={remaining}
          current={progress.customers}
          target={progress.next?.minCustomers ?? null}
        />
        <section className="rounded-xl border bg-card p-6" aria-labelledby="setup-title">
          <h2 id="setup-title" className="text-sm font-medium text-muted-foreground">{t.setup.title}</h2>
          <p className="mt-1 font-semibold">
            {overview.setup.configured ? t.setup.states[overview.setup.state].title : t.setup.states.unavailable.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview.setup.configured ? t.setup.states[overview.setup.state].body : t.setup.states.unavailable.body}
          </p>
          <Link href="/partner/settings" className="mt-4 inline-block text-sm font-medium text-primary-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {t.nav.settings}
          </Link>
        </section>
      </div>

      <CouponsPanel copy={t} coupons={overview.coupons.map((coupon) => couponView(coupon, t, locale))} />
    </div>
  );
}

function Banner({ icon: Icon, title, body }: { icon: typeof AlertTriangle; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4" role="status">
      <Icon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
