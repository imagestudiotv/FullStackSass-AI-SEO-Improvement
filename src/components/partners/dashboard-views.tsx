import { Download } from "lucide-react";
import Link from "next/link";

import type { PartnerCopy } from "@/lib/partners/presentation/copy";
import type { balanceView, commissionRowView, couponView, metricsView, payoutRowView, referralRowView } from "@/lib/partners/presentation/views";
import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";
import { Figure, PortalEmpty, PortalSection, ResponsiveList, StatusPill } from "./portal-ui";

/**
 * The partner portal's panels: layout for view models built on the server
 * (presentation/views.ts). Nothing here computes a figure.
 */

type Portal = PartnerCopy["portal"];

export function EarningsPanel({ balances, copy, nextPayout }: { balances: ReturnType<typeof balanceView>[]; copy: Portal; nextPayout: string }) {
  const o = copy.overview;
  return (
    <PortalSection id="earnings-title" title={o.balancesTitle} description={`${o.currencyNote} ${nextPayout}`}>
      {balances.length === 0 ? (
        <PortalEmpty>{o.noEarnings}</PortalEmpty>
      ) : (
        <div className="space-y-6">
          {balances.map((balance) => (
            <div key={balance.currency} aria-labelledby={`balance-${balance.currency}`} role="group">
              <h3 id={`balance-${balance.currency}`} className="text-sm font-semibold">
                {balance.currency}
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {balance.figures.map((figure) => (
                  <Figure key={figure.key} label={figure.label} value={figure.value} definition={figure.definition} />
                ))}
              </dl>
              {balance.notes.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {balance.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PortalSection>
  );
}

export function MetricsPanel({
  metrics,
  copy,
  ranges,
}: {
  metrics: ReturnType<typeof metricsView>;
  copy: Portal;
  ranges: { days: number; href: string; current: boolean; label: string }[];
}) {
  return (
    <PortalSection
      id="metrics-title"
      title={copy.overview.metrics.period}
      description={metrics.period}
      actions={
        <nav aria-label={copy.overview.metrics.period}>
          <ul className="flex gap-1 rounded-lg border p-1">
            {ranges.map((range) => (
              <li key={range.days}>
                <Link
                  href={range.href}
                  aria-current={range.current ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                    range.current ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {range.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.tiles.map((tile) => (
          <div key={tile.key} className="min-w-0 rounded-lg border bg-background p-3">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{metrics.definition}</p>
    </PortalSection>
  );
}

export function CouponsPanel({ coupons, copy }: { coupons: ReturnType<typeof couponView>[]; copy: Portal }) {
  return (
    <PortalSection id="coupons-title" title={copy.overview.couponsTitle}>
      {coupons.length === 0 ? (
        <PortalEmpty>{copy.overview.noCoupons}</PortalEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {coupons.map((coupon) => (
            <li key={coupon.code} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
              <div className="min-w-0">
                <p id={`coupon-${coupon.code}`} className="font-mono font-semibold">
                  {coupon.code}
                </p>
                <p className="text-sm text-muted-foreground">{coupon.discount}</p>
              </div>
              <CopyButton text={coupon.code} label={copy.overview.copyCode} copiedLabel={copy.overview.copied} describedBy={`coupon-${coupon.code}`} />
            </li>
          ))}
        </ul>
      )}
    </PortalSection>
  );
}

export function CommissionList({ rows, copy }: { rows: ReturnType<typeof commissionRowView>[]; copy: Portal }) {
  const c = copy.commissions;
  if (rows.length === 0) return <PortalEmpty>{c.empty}</PortalEmpty>;
  return (
    <ResponsiveList
      caption={c.title}
      columns={[
        { key: "date", label: c.date },
        { key: "customer", label: c.customer },
        { key: "base", label: c.base, align: "end" },
        { key: "rate", label: c.rate, align: "end" },
        { key: "amount", label: c.amount, align: "end" },
        { key: "status", label: c.status },
      ]}
      rows={rows.map((row) => ({
        id: row.id,
        cells: {
          date: row.date,
          customer: <span className="break-all">{row.customer}</span>,
          base: row.base,
          rate: row.rate,
          amount: (
            <span>
              {row.amount}
              {row.reversed ? <span className="block text-xs text-muted-foreground">{row.reversed}</span> : null}
            </span>
          ),
          status: (
            <span className="inline-flex flex-col items-end gap-1 md:items-start">
              <StatusPill tone={row.tone} label={row.status} />
              {row.matures ? (
                <span className="text-xs text-muted-foreground">
                  {c.matures}: {row.matures}
                </span>
              ) : null}
            </span>
          ),
        },
      }))}
    />
  );
}

export function PayoutList({ rows, copy }: { rows: ReturnType<typeof payoutRowView>[]; copy: Portal }) {
  const p = copy.payouts;
  if (rows.length === 0) return <PortalEmpty>{p.empty}</PortalEmpty>;
  return (
    <ResponsiveList
      caption={p.title}
      columns={[
        { key: "date", label: p.date },
        { key: "amount", label: p.amount, align: "end" },
        { key: "transfer", label: p.transfer },
        { key: "bank", label: p.bank },
      ]}
      rows={rows.map((row) => ({
        id: row.id,
        cells: {
          date: row.date,
          amount: (
            <span>
              {row.amount}
              {row.offset ? <span className="block text-xs text-muted-foreground">{row.offset}</span> : null}
            </span>
          ),
          transfer: <StatusPill tone={row.transferTone} label={row.transfer} />,
          bank: (
            <span className="inline-flex flex-col items-end gap-1 md:items-start">
              <StatusPill tone={row.bankTone} label={row.bank} />
              {row.bankDetail ? <span className="text-xs text-muted-foreground">{row.bankDetail}</span> : null}
            </span>
          ),
        },
      }))}
    />
  );
}

export function ReferralList({ rows, copy }: { rows: ReturnType<typeof referralRowView>[]; copy: Portal }) {
  const r = copy.referrals;
  if (rows.length === 0) return <PortalEmpty>{r.empty}</PortalEmpty>;
  return (
    <ResponsiveList
      caption={r.title}
      columns={[
        { key: "customer", label: r.customer },
        { key: "source", label: r.source },
        { key: "since", label: r.since },
        { key: "status", label: r.status },
      ]}
      rows={rows.map((row) => ({
        id: row.id,
        cells: {
          customer: <span className="break-all">{row.customer}</span>,
          source: row.source,
          since: row.since,
          status: <StatusPill tone={row.tone} label={row.status} />,
        },
      }))}
    />
  );
}

export type ResourceFile = { href: string; name: string; detail: string; preview: string; previewClassName?: string; width: number; height: number };

export function ResourcesView({
  copy,
  logos,
  banners,
  templates,
}: {
  copy: Portal;
  logos: ResourceFile[];
  banners: ResourceFile[];
  templates: { title: string; body: string }[];
}) {
  const r = copy.resources;
  return (
    <div className="space-y-6">
      <PortalSection id="logos-title" title={r.logos} description={r.logosIntro}>
        <FileGrid files={logos} download={r.download} />
      </PortalSection>
      <PortalSection id="banners-title" title={r.banners} description={r.bannersIntro}>
        <FileGrid files={banners} download={r.download} />
      </PortalSection>
      <PortalSection id="copy-title" title={r.copyTitle} description={r.copyIntro}>
        <ul className="space-y-3">
          {templates.map((template, index) => (
            <li key={template.title} className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{template.title}</h3>
                <CopyButton text={template.body} label={r.copyText} copiedLabel={copy.overview.copied} describedBy={`template-${index}`} />
              </div>
              <p id={`template-${index}`} className="mt-2 whitespace-pre-line break-words text-sm">
                {template.body}
              </p>
            </li>
          ))}
        </ul>
      </PortalSection>
      <PortalSection id="rules-title" title={r.rules}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {r.rulesList.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </PortalSection>
    </div>
  );
}

function FileGrid({ files, download }: { files: ResourceFile[]; download: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((file) => (
        <li key={file.href} className="flex min-w-0 flex-col rounded-lg border bg-background">
          <div className={cn("flex h-32 items-center justify-center overflow-hidden rounded-t-lg p-3", file.previewClassName ?? "bg-muted/40")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a download preview at its own aspect ratio, not page content */}
            <img src={file.preview} alt="" width={file.width} height={file.height} loading="lazy" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-1 items-center justify-between gap-2 border-t p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{file.detail}</p>
            </div>
            <a
              href={file.href}
              download
              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Download className="size-3.5" aria-hidden="true" />
              {download}
              <span className="sr-only">: {file.name}</span>
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
