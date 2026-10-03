import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileWarning,
  Globe,
  Link2Off,
  PauseCircle,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { LineChart } from "@/components/reports/line-chart";
import { getPlatformStats } from "@/lib/admin/actions";
import {
  ACTIVITY_RANGES,
  FAILED_PAYMENTS_RANGE,
  getArticleActivity,
  getAttention,
  getRecentAdminActions,
  getSubscriptionMix,
  parseActivityRange,
  type ActivityRange,
} from "@/lib/admin/dashboard";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "./_ui/page";
import { AdminUnavailable } from "./_ui/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const n = (value: number) => formatNumber(value, "en");
const eur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    cents / 100,
  );
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const when = (date: Date) =>
  formatDate(date, "en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

async function attempt<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error("[admin/overview] section failed", error);
    return null;
  }
}

/**
 * The operator's first screen: what needs attention, what the platform looks
 * like now, what happened over the chosen period, and what administrators
 * did last. Every figure is a real query; one that fails says so instead of
 * showing zero.
 */
export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const range = parseActivityRange((await searchParams).range);
  const [stats, attention, mix, activity, recent] = await Promise.all([
    attempt(() => getPlatformStats()),
    getAttention(),
    attempt(() => getSubscriptionMix()),
    attempt(() => getArticleActivity(range)),
    attempt(() => getRecentAdminActions(8)),
  ]);

  const freeze = attention.controls?.find((control) => control.key === "publication_freeze");
  const managed = attention.controls?.find((control) => control.key === "managed_review");

  const items: AttentionItem[] = [
    { label: "Articles awaiting review", count: attention.awaitingReview, href: "/admin/network", icon: ClipboardCheck, tone: "warning", detail: "Partner Network drafts waiting for the team" },
    { label: "Unresolved deliveries", count: attention.unresolvedDeliveries, href: "/admin/network/operations", icon: Send, tone: "danger", detail: "Sends whose outcome is not known" },
    { label: "Missing partner links", count: attention.missingLinks, href: "/admin/network#missing-links", icon: Link2Off, tone: "warning", detail: "Not found on recent checks - not yet removed", cap: 100 },
    { label: "Failed articles", count: attention.failedArticles, href: "/admin/articles?status=failed", icon: FileWarning, tone: "danger", detail: "Generation failed" },
    { label: "Failed payments", count: attention.failedPayments, href: `/admin/payments?status=failed&paid=${FAILED_PAYMENTS_RANGE}`, icon: CreditCard, tone: "danger", detail: "Charges that failed in the last 30 days" },
    { label: "Past-due subscriptions", count: attention.pastDue, href: "/admin/organizations?status=past_due", icon: CreditCard, tone: "warning", detail: "Payment overdue" },
    { label: "Websites with failed analysis", count: attention.failedWebsites, href: "/admin/websites?status=failed", icon: Globe, tone: "warning", detail: "Site analysis did not finish" },
  ];
  const open = items.filter((item) => item.count === null || item.count > 0);
  const clear = items.filter((item) => item.count === 0);

  return (
    <AdminPage>
      <AdminPageHeader title="Overview" description="What needs attention, the platform as it stands, and recent activity across all customers." />

      {/* Operational switches that change what the whole platform does - shown first when on. */}
      {freeze?.enabled || managed?.enabled ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {freeze?.enabled ? (
            <Banner icon={PauseCircle} title="Publication freeze is ON" href="/admin/network/operations">
              Nothing is being sent to customers&apos; sites until it is lifted.{freeze.reason ? ` Reason: ${freeze.reason}` : ""}
            </Banner>
          ) : null}
          {managed?.enabled ? (
            <Banner icon={ShieldCheck} title="Managed review is ON" href="/admin/network/operations" tone="info">
              Partner Network articles wait for the team&apos;s approval before release.
            </Banner>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AdminSection
          title="Needs attention"
          description="Open items, most consequential first. Each opens the view where it is handled."
          bodyClassName="p-0"
        >
          {open.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm">
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
              <p>Nothing needs attention right now.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {open.map((item) => (
                <li key={item.label}>
                  <AttentionRow item={item} />
                </li>
              ))}
            </ul>
          )}
          {clear.length > 0 ? (
            <p className="border-t px-5 py-3 text-xs text-muted-foreground">
              All clear: {clear.map((item) => item.label.toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </AdminSection>

        <AdminSection
          title="Recent admin activity"
          actions={
            <Link href="/admin/activity" className="inline-flex items-center gap-1 rounded text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
          bodyClassName="p-0"
        >
          {recent === null ? (
            <AdminUnavailable className="m-4" title="Activity could not be loaded" />
          ) : recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No administrator actions recorded yet.</p>
          ) : (
            <ol className="divide-y">
              {recent.map((entry) => (
                <li key={entry.id} className="px-5 py-3">
                  <p className="line-clamp-2 text-sm [overflow-wrap:anywhere]">{entry.summary}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span className="truncate">{entry.actorEmail}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={entry.createdAt.toISOString()}>{when(entry.createdAt)} UTC</time>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </AdminSection>
      </div>

      {/* Current totals: right now, whatever range is chosen below. */}
      <section aria-labelledby="totals-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="totals-title" className="text-base font-semibold">Platform now</h2>
          <p className="text-xs text-muted-foreground">Current totals - not affected by the date range.</p>
        </div>
        {stats === null ? <AdminUnavailable title="Platform totals could not be loaded" /> : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <AdminStat label="Organizations" value={stats ? n(stats.organizations) : "-"} unavailable={!stats} href="/admin/organizations" hint="Workspaces, including agency" />
          <AdminStat label="Websites" value={stats ? n(stats.websites) : "-"} unavailable={!stats} href="/admin/websites" />
          <AdminStat label="Users" value={stats ? n(stats.users) : "-"} unavailable={!stats} href="/admin/users" hint="People with an account" />
          <AdminStat label="Articles" value={stats ? n(stats.articles) : "-"} unavailable={!stats} href="/admin/articles" hint="Every status" />
          <AdminStat label="Published articles" value={stats ? n(stats.publishedArticles) : "-"} unavailable={!stats} href="/admin/articles?status=published" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminStat
            label="Entitled subscriptions"
            value={stats ? n(stats.activeSubscriptions) : "-"}
            unavailable={!stats}
            hint={mix ? `${n(mix.active)} active · ${n(mix.trialing)} trialing · ${n(mix.pastDue)} past due` : "Active, trialing and past due"}
          />
          <AdminStat
            label="Plan value of those subscriptions"
            value={stats ? eur(stats.monthlyRevenueCents) : "-"}
            unavailable={!stats}
            hint="Sum of their plan prices in EUR; annual plans at their yearly price, trials included"
          />
          <AdminStat
            label="Provider cost this month"
            value={stats ? usd(stats.providerCostUsd) : "-"}
            unavailable={!stats}
            hint="AI and SEO providers since the 1st, in USD - kept apart from EUR revenue"
          />
        </div>
      </section>

      <AdminSection
        title="Article activity"
        description={
          activity
            ? `Per UTC day, ${formatDate(activity.from, "en", { day: "numeric", month: "short", timeZone: "UTC" })} – ${formatDate(activity.to, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}. The range applies to this section only.`
            : "Per UTC day. The range applies to this section only."
        }
        actions={<RangePicker range={range} />}
      >
        {activity === null ? (
          <AdminUnavailable title="Activity could not be loaded" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBlock
              title="Articles written"
              total={activity.totals.written}
              definition="Articles created, by the day they were created."
              points={activity.days.map((day) => ({ day: day.day, value: day.written }))}
            />
            <ChartBlock
              title="Articles that went live"
              total={activity.totals.live}
              definition="First confirmed live on the customer's site. Recorded since late September 2026, so earlier days undercount."
              points={activity.days.map((day) => ({ day: day.day, value: day.live }))}
            />
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}

type AttentionItem = {
  label: string;
  count: number | null;
  href: string;
  icon: LucideIcon;
  tone: "warning" | "danger";
  detail: string;
  /** The query stops at this many; shown as "100+". */
  cap?: number;
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const unavailable = item.count === null;
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 px-5 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          unavailable ? "bg-muted text-muted-foreground" : item.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
        )}
        aria-hidden="true"
      >
        {unavailable ? <AlertTriangle className="size-4" /> : <item.icon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{unavailable ? "Could not be counted - open the page to check" : item.detail}</span>
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {unavailable ? <span className="text-sm font-medium text-muted-foreground">Unavailable</span> : item.cap && item.count! >= item.cap ? `${n(item.cap)}+` : n(item.count!)}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

function Banner({
  icon: Icon,
  title,
  href,
  tone = "warning",
  children,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  tone?: "warning" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/30 bg-warning-soft" : "border-info/25 bg-info-soft",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-warning" : "text-info")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-foreground/75 [overflow-wrap:anywhere]">{children}</p>
      </div>
      <Link href={href} className="shrink-0 rounded text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        Operations
      </Link>
    </div>
  );
}

function RangePicker({ range }: { range: ActivityRange }) {
  return (
    <nav aria-label="Date range" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {(Object.keys(ACTIVITY_RANGES) as ActivityRange[]).map((key) => (
        <Link
          key={key}
          href={key === "30d" ? "/admin" : `/admin?range=${key}`}
          scroll={false}
          aria-current={key === range ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            key === range ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="hidden sm:inline">Last </span>
          {ACTIVITY_RANGES[key]} days
        </Link>
      ))}
    </nav>
  );
}

function ChartBlock({
  title,
  total,
  definition,
  points,
}: {
  title: string;
  total: number;
  definition: string;
  points: { day: string; value: number }[];
}) {
  return (
    <figure className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums">{n(total)}</span>{" "}
          <span className="text-muted-foreground">in range</span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{definition}</p>
      {total === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">None in this range.</p>
      ) : (
        <LineChart
          points={points}
          label={title}
          unit={{ kind: "count" }}
          unitLabel="articles"
          locale="en"
          noDataLabel="No data"
          dayLabel="Day"
          valueLabel="Articles"
          instructions="Use the left and right arrow keys to move between days."
          size="compact"
          tone="brand"
        />
      )}
    </figure>
  );
}
