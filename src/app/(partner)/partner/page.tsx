import { AlertTriangle, PauseCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReferralLink } from "@/components/partners/referral-link";
import { TierProgress } from "@/components/partners/tier-progress";
import { partnerOverview } from "@/lib/partners/application/queries/partner-overview";
import { fill } from "@/lib/partners/presentation/copy";
import { rateLabel } from "@/lib/partners/presentation/format";
import { partnerDeps } from "@/lib/partners/server";

import { requirePartnerPage } from "./portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.overview.title };
}

export default async function PartnerOverviewPage() {
  const { access, copy } = await requirePartnerPage();
  const overview = await partnerOverview(partnerDeps(), access.context);
  if (!overview) notFound();
  const t = copy.portal;
  const { progress, partner, policy } = overview;
  const remaining = progress.next
    ? fill(t.overview.remaining, { count: progress.remaining, tier: progress.next.name, rate: rateLabel(progress.next.rateBasisPoints) })
    : t.overview.topTier;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.overview.title}</h1>

      {partner.status === "suspended" ? (
        <Banner icon={AlertTriangle} title={t.suspended.title} body={t.suspended.body} />
      ) : partner.payoutHoldReason ? (
        <Banner icon={PauseCircle} title={t.hold.title} body={t.hold.body} />
      ) : null}

      <section className="rounded-xl border bg-card p-6" aria-labelledby="link-title">
        <h2 id="link-title" className="font-semibold">{t.overview.linkTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{fill(t.overview.linkHint, { days: policy.attributionWindowDays })}</p>
        <div className="mt-4">
          <ReferralLink url={overview.referralUrl} label={t.overview.linkTitle} copyLabel={t.overview.copy} copiedLabel={t.overview.copied} />
        </div>
      </section>

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
