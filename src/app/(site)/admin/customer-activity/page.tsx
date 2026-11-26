import { Activity, AlertTriangle, ArrowRight, Building2, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FEED_LIMIT,
  getCustomerActivity,
  getCustomerTimeline,
  isRange,
  TIMELINE_LIMIT,
  type ActivityCustomer,
  type ActivityRow,
  type AttentionRow,
  type CustomerTimeline,
} from "@/lib/admin/customer-activity";
import {
  ACTIVITY_GROUPS,
  exactUtc,
  GROUP_LABEL,
  relativeTime,
  timelineHref,
  websiteHref,
  type PlanBadge as PlanBadgeValue,
} from "@/lib/admin/customer-activity-rules";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus, type StatusTone } from "../_ui/status";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../_ui/toolbar";
import { n, RelatedLink } from "../organizations/list-parts";
import { AutoRefresh, LiveFeed, NewMark } from "./live";

/**
 * Admin -> Customer activity (owner, 2026-11-26: "I have to check the
 * activities of the new customers in real time"). Before it, following a new
 * trial meant reloading Users, Websites, Organizations, Articles, Payments,
 * Onboarding help and Free plan launch one by one, and nothing said a trial
 * was stuck.
 *
 * One live feed of customer events (every stored timestamp, newest first),
 * the "Needs attention" box above it, and ?org=<id> for one workspace's
 * whole timeline. READ ONLY: no action on this page writes anything. Guarded
 * by the admin layout and again by requireAdmin in each query
 * (lib/admin/customer-activity.ts). Admin -> Activity stays the audit log of
 * administrators' own actions.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer activity" };

const BASE = "/admin/customer-activity";

const FILTERS: ToolbarFilter[] = [
  {
    param: "type",
    label: "Type",
    allValue: "all",
    options: [{ value: "all", label: "Any" }, ...ACTIVITY_GROUPS.map((group) => ({ value: group, label: GROUP_LABEL[group] }))],
  },
  {
    param: "plan",
    label: "Plan",
    allValue: "all",
    options: [
      { value: "all", label: "Any" },
      { value: "free", label: "Free" },
      { value: "trial", label: "Trial" },
      { value: "paid", label: "Paid" },
    ],
  },
  {
    param: "range",
    label: "Range",
    allValue: "7d",
    options: [
      { value: "24h", label: "Last 24 hours" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
    ],
  },
  {
    param: "ours",
    label: "Our own workspaces",
    allValue: "hide",
    options: [
      { value: "hide", label: "Hidden" },
      { value: "include", label: "Included" },
    ],
  },
];

const BADGE_TONE: Record<PlanBadgeValue["kind"], StatusTone> = {
  agency: "info",
  trial: "info",
  paid: "success",
  free: "pending",
  none: "neutral",
};

function PlanBadge({ badge }: { badge: PlanBadgeValue | null }) {
  if (!badge) return <span className="text-muted-foreground">-</span>;
  return <AdminStatus tone={BADGE_TONE[badge.kind]} label={badge.label} icon={badge.kind === "agency" ? Building2 : null} />;
}

/** Relative, with the exact UTC time on hover. */
function When({ at, now }: { at: Date; now: Date }) {
  return (
    <time dateTime={at.toISOString()} title={exactUtc(at)} className="whitespace-nowrap tabular-nums">
      {relativeTime(at, now)}
    </time>
  );
}

function Customer({ customer, link = true }: { customer: ActivityCustomer; link?: boolean }) {
  return (
    <div className="min-w-0">
      {customer.organizationId && customer.name ? (
        link ? (
          <RelatedLink href={timelineHref(customer.organizationId)} label={`${customer.name}: whole timeline`} className="font-medium wrap-anywhere">
            {customer.name}
          </RelatedLink>
        ) : (
          <span className="font-medium wrap-anywhere">{customer.name}</span>
        )
      ) : (
        <span className="text-muted-foreground">No workspace yet</span>
      )}
      {customer.ownerEmail ? <p className="text-xs text-muted-foreground wrap-anywhere">{customer.ownerEmail}</p> : null}
    </div>
  );
}

function Domain({ domain }: { domain: string | null }) {
  if (!domain) return <span className="text-muted-foreground">-</span>;
  return (
    <RelatedLink href={websiteHref(domain)} className="wrap-anywhere">
      {domain}
    </RelatedLink>
  );
}

function EventText({ row }: { row: ActivityRow }) {
  return (
    <span className={row.group === "problems" ? "text-danger" : undefined}>
      {row.group === "problems" ? <AlertTriangle className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" /> : null}
      <span className="wrap-anywhere">{row.text}</span>
    </span>
  );
}

function Attention({ items, now, showCustomer = true }: { items: AttentionRow[]; now: Date; showCustomer?: boolean }) {
  if (items.length === 0) return null;
  return (
    <AdminSection
      id="needs-attention"
      title={`Needs attention (${n(items.length)})`}
      description="Worked out on every load: trials with no article after 6 hours, failed analyses, entitled websites with no content plan after an hour, failed articles (48 h), failed payments (7 days), trials ending within 24 hours with nothing written. Longest waiting first."
      className="border-warning/40"
      bodyClassName="p-0"
    >
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-2 px-5 py-3 text-sm md:flex-row md:items-center md:gap-4">
            {showCustomer ? (
              <div className="md:w-56 md:shrink-0">
                <Customer customer={item.customer} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="wrap-anywhere">{item.why}</p>
              <p className="text-xs text-muted-foreground">
                {item.domain ? <>{item.domain} · </> : null}
                since <When at={item.since} now={now} />
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="h-8 shrink-0 self-start bg-background md:self-center">
              <Link href={item.href}>
                {item.hrefLabel}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}

function EventLink({ row }: { row: ActivityRow }) {
  if (!row.href) return null;
  return (
    <RelatedLink href={row.href} className="text-xs text-muted-foreground">
      {row.hrefLabel}
    </RelatedLink>
  );
}

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function CustomerActivityPage({ searchParams }: PageProps<"/admin/customer-activity">) {
  const params = await searchParams;
  const org = param(params.org);
  if (org) {
    const timeline = await getCustomerTimeline(org);
    return timeline ? <Timeline timeline={timeline} /> : <MissingWorkspace />;
  }

  const search = param(params.q).trim();
  const group = param(params.type) || "all";
  const plan = param(params.plan) || "all";
  const range = isRange(params.range) ? params.range : "7d";
  const includeOurs = param(params.ours) === "include";
  const beforeValue = param(params.before);
  const before = beforeValue && !Number.isNaN(Date.parse(beforeValue)) ? new Date(beforeValue) : null;

  const data = await getCustomerActivity({ group, filters: { plan, search, includeOurs }, range, before });
  const filtering = Boolean(search || group !== "all" || plan !== "all");
  const scope = JSON.stringify({ search, group, plan, range, includeOurs, before: before?.toISOString() ?? null });

  const keepParams = new URLSearchParams();
  if (search) keepParams.set("q", search);
  if (group !== "all") keepParams.set("type", group);
  if (plan !== "all") keepParams.set("plan", plan);
  if (range !== "7d") keepParams.set("range", range);
  if (includeOurs) keepParams.set("ours", "include");
  const olderFrom = data.truncated ? data.rows.at(-1)!.at : data.since;
  const olderParams = new URLSearchParams(keepParams);
  olderParams.set("before", olderFrom.toISOString());
  const newestHref = keepParams.size > 0 ? `${BASE}?${keepParams}` : BASE;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Customer activity"
        description="What customers did and what happened to them, newest first, from what RepGet already records. Refreshes every 30 seconds while this tab is open. Click a customer for their whole timeline. Read only."
        actions={<AutoRefresh renderedAt={data.now.getTime()} />}
      />

      <Attention items={data.attention} now={data.now} />

      <AdminToolbar
        searchPlaceholder="Search email, domain or workspace"
        filters={FILTERS}
        resultLabel={`${n(data.rows.length)}${data.truncated ? "+" : ""} ${data.rows.length === 1 ? "event" : "events"}${
          !includeOurs && data.hiddenOurs > 0 ? ` · ${n(data.hiddenOurs)} of our own workspaces hidden` : ""
        }`}
      />

      {before ? (
        <p className="text-sm text-muted-foreground">
          Showing events before {exactUtc(before)}.{" "}
          <Link href={newestHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            Back to the newest
          </Link>
        </p>
      ) : null}

      <AdminTableCard
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {data.truncated
                ? `The newest ${n(FEED_LIMIT)} events of this range are shown.`
                : `Every event since ${exactUtc(data.since)}.`}
            </span>
            <Button variant="outline" size="sm" asChild className="h-8 bg-background">
              <Link href={`${BASE}?${olderParams}`}>
                <History className="size-3.5" aria-hidden="true" />
                Load older
              </Link>
            </Button>
          </div>
        }
      >
        {data.rows.length > 0 ? (
          <LiveFeed keys={data.rows.map((row) => row.key)} renderedAt={data.now.getTime()} scope={scope}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Time (UTC)</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden lg:table-cell">Website</TableHead>
                  <TableHead className="hidden md:table-cell">Plan</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.key} data-activity-key={row.key}>
                    <TableCell className="align-top">
                      <When at={row.at} now={data.now} />
                      <NewMark rowKey={row.key} />
                    </TableCell>
                    <TableCell className="min-w-40 whitespace-normal align-top">
                      <Customer customer={row.customer} />
                    </TableCell>
                    <TableCell className="hidden whitespace-normal align-top lg:table-cell">
                      <Domain domain={row.domain} />
                    </TableCell>
                    <TableCell className="hidden align-top md:table-cell">
                      <PlanBadge badge={row.customer.badge} />
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-normal align-top">
                      <EventText row={row} />
                      {row.domain ? <p className="text-xs text-muted-foreground lg:hidden">{row.domain}</p> : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <EventLink row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </LiveFeed>
        ) : (
          <AdminEmpty
            filtering={filtering}
            icon={Activity}
            title={before ? "No older events in this range" : "No customer activity in this range"}
            description="Sign-ups, websites, plans, payments, articles, posts and videos appear here as they happen."
            noun="events"
            clearHref={BASE}
          />
        )}
      </AdminTableCard>
    </AdminPage>
  );
}

const day = (at: Date | null) => (at ? exactUtc(at).slice(0, 16) + " UTC" : "-");

function capitalise(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function MissingWorkspace() {
  return (
    <AdminPage>
      <AdminPageHeader title="Customer activity" back={{ href: BASE, label: "All customer activity" }} />
      <AdminTableCard>
        <AdminEmpty filtering={false} icon={Building2} title="No such workspace" description="It may have been deleted." noun="workspaces" />
      </AdminTableCard>
    </AdminPage>
  );
}

function Timeline({ timeline }: { timeline: CustomerTimeline }) {
  const { workspace, now } = timeline;
  const domainOf = new Map(timeline.websites.map((site) => [site.id, site.domain]));
  // In order: the oldest first, as the customer lived it.
  const rows = [...timeline.rows].reverse();
  return (
    <AdminPage width="default">
      <AdminPageHeader
        title={workspace.name || "Unnamed workspace"}
        back={{ href: BASE, label: "All customer activity" }}
        meta={
          <>
            <PlanBadge badge={timeline.badge} />
            {workspace.ownerEmail ? <span className="wrap-anywhere">{workspace.ownerEmail}</span> : null}
            <span>Created {day(workspace.createdAt)}</span>
            {timeline.ours ? <AdminStatus tone="neutral" label="One of our own workspaces" icon={null} /> : null}
          </>
        }
        actions={<AutoRefresh renderedAt={now.getTime()} />}
      />

      <Attention items={timeline.attention} now={now} showCustomer={false} />

      <AdminSection title="Plan" bodyClassName="p-0">
        {timeline.subscriptions.length > 0 || timeline.freeStartedAt ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Period / trial ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.freeStartedAt ? (
                <TableRow>
                  <TableCell>-</TableCell>
                  <TableCell>Free</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="tabular-nums">{day(timeline.freeStartedAt)}</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
              ) : null}
              {timeline.subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="whitespace-normal">{sub.websiteId ? (domainOf.get(sub.websiteId) ?? "Another website") : "Detached"}</TableCell>
                  <TableCell>
                    {sub.planName ?? "-"}
                    {sub.trial ? <span className="text-muted-foreground"> (trial)</span> : null}
                  </TableCell>
                  <TableCell>{capitalise(sub.status)}</TableCell>
                  <TableCell className="tabular-nums">{day(sub.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal tabular-nums">
                    {sub.status === "trialing" ? "Trial ends " : ""}
                    {day(sub.periodEnd)}
                    {sub.cancelAtPeriodEnd ? <span className="block text-xs text-warning">Cancels {day(sub.cancelAt ?? sub.periodEnd)}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">No plan, trial or Free started.</p>
        )}
      </AdminSection>

      <AdminSection title="Websites" description="With why each has, or has not yet, an article (the same reading as Admin -> Websites)." bodyClassName="p-0">
        {timeline.websites.length > 0 ? (
          <ul className="divide-y">
            {timeline.websites.map((site) => (
              <li key={site.id} className="flex flex-col gap-1 px-5 py-3 text-sm md:flex-row md:items-start md:gap-4">
                <div className="md:w-64 md:shrink-0">
                  <Domain domain={site.domain} />
                  <p className="text-xs text-muted-foreground">
                    {capitalise(site.status)} · added {day(site.createdAt)}
                  </p>
                </div>
                <p className={site.firstArticle && !site.firstArticle.waiting && site.firstArticle.code !== "written" ? "text-warning" : "text-muted-foreground"}>
                  {site.firstArticle?.message ?? "Its article status could not be read."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">No website added yet.</p>
        )}
      </AdminSection>

      <AdminSection title="Articles per day" description="UTC days, newest first: articles started, and of those written." bodyClassName="p-0">
        {timeline.articlesPerDay.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead data-numeric>Started</TableHead>
                <TableHead data-numeric>Written</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.articlesPerDay.map((entry) => (
                <TableRow key={entry.day}>
                  <TableCell className="tabular-nums">{entry.day}</TableCell>
                  <TableCell data-numeric>{n(entry.started)}</TableCell>
                  <TableCell data-numeric>{n(entry.written)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">No article started yet.</p>
        )}
      </AdminSection>

      <AdminSection
        title="Timeline"
        description={
          timeline.truncated
            ? `The latest ${n(TIMELINE_LIMIT)} events, oldest first.`
            : "Everything recorded for this workspace, oldest first."
        }
        bodyClassName="p-0"
      >
        {rows.length > 0 ? (
          <LiveFeed keys={rows.map((row) => row.key)} renderedAt={now.getTime()} scope={workspace.id}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Time (UTC)</TableHead>
                  <TableHead className="hidden md:table-cell">Website</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key} data-activity-key={row.key}>
                    <TableCell className="align-top">
                      <span className="block whitespace-nowrap tabular-nums">{exactUtc(row.at).slice(0, 16)}</span>
                      <span className="text-xs text-muted-foreground">
                        <When at={row.at} now={now} />
                      </span>
                      <NewMark rowKey={row.key} />
                    </TableCell>
                    <TableCell className="hidden whitespace-normal align-top md:table-cell">
                      <Domain domain={row.domain} />
                    </TableCell>
                    <TableCell className="min-w-56 whitespace-normal align-top">
                      <EventText row={row} />
                    </TableCell>
                    <TableCell className="align-top">
                      <EventLink row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </LiveFeed>
        ) : (
          <AdminEmpty filtering={false} icon={Activity} title="Nothing recorded yet" noun="events" />
        )}
      </AdminSection>
    </AdminPage>
  );
}
