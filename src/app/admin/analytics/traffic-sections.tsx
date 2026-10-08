import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ExternalLink, Minus, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LineChart } from "@/components/reports/line-chart";
import { Button } from "@/components/ui/button";
import { KEY_VAR, PROPERTY_VAR, type Ga4Setup } from "@/lib/admin/ga4";
import {
  DEFAULT_TRAFFIC_RANGE,
  TRAFFIC_RANGES,
  type SiteTraffic,
  type SiteTrafficResult,
  type TrafficRange,
} from "@/lib/admin/site-traffic";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { AdminSection, AdminStat } from "../_ui/page";
import { change, count, duration, percent, share, type Change } from "./figures";

/**
 * The Site analytics page's sections, one per state: not set up, failed, no
 * visits yet, and the report. Server components; only the charts run in the
 * browser.
 */

export function gaReportUrl(propertyId: string): string {
  return `https://analytics.google.com/analytics/web/#/p${propertyId}/reports/intelligenthome`;
}

const day = (iso: string, withYear = true) =>
  formatDate(`${iso}T00:00:00Z`, "en", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

export function periodText(traffic: SiteTraffic): string {
  return `${day(traffic.window.start, false)} – ${day(traffic.window.end)}, ${traffic.timeZone} time`;
}

function External({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded font-medium text-foreground underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function TrafficRangePicker({ range }: { range: TrafficRange }) {
  return (
    <nav aria-label="Date range" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {(Object.keys(TRAFFIC_RANGES) as TrafficRange[]).map((key) => (
        <Link
          key={key}
          href={key === DEFAULT_TRAFFIC_RANGE ? "/admin/analytics" : `/admin/analytics?range=${key}`}
          scroll={false}
          aria-current={key === range ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            key === range ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="hidden sm:inline">Last </span>
          {TRAFFIC_RANGES[key]} days
        </Link>
      ))}
    </nav>
  );
}

export function OpenInGoogleAnalytics({ propertyId }: { propertyId: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={gaReportUrl(propertyId)} target="_blank" rel="noopener noreferrer">
        Open Google Analytics
        <ExternalLink className="size-3.5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </Button>
  );
}

/** Everything below the page header, for whichever state the data is in. */
export function TrafficView({ result }: { result: SiteTrafficResult }) {
  if (result.status === "setup") return <SetupGuide setup={result.setup} />;
  if (result.status === "error") return <TrafficError result={result} />;
  return <TrafficReport traffic={result.traffic} />;
}

/* ------------------------------------------------------------------ */
/* Not set up                                                          */
/* ------------------------------------------------------------------ */

function VariableStatus({ name, state, detail }: { name: string; state: "set" | "missing" | "invalid"; detail: ReactNode }) {
  const Icon = state === "set" ? CheckCircle2 : state === "invalid" ? XCircle : Minus;
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", state === "set" ? "text-success" : state === "invalid" ? "text-danger" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <div className="min-w-0 text-sm">
        <p>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{name}</code>{" "}
          <span className="font-medium">{state === "set" ? "Set" : state === "invalid" ? "Not usable" : "Not set"}</span>
        </p>
        <p className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{detail}</p>
      </div>
    </li>
  );
}

export function SetupGuide({ setup }: { setup: Exclude<Ga4Setup, { state: "ready" }> }) {
  const invalid = setup.state === "invalid" ? setup : null;
  const propertyState = invalid?.variable === PROPERTY_VAR ? "invalid" : setup.propertyId ? "set" : "missing";
  const keyState = invalid?.variable === KEY_VAR ? "invalid" : setup.clientEmail ? "set" : "missing";
  const email = setup.clientEmail;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <AdminSection
        title="Connect Google Analytics"
        description="This page reads RepGet's own Google Analytics 4 property with a read-only Google service account. Set it up once; nothing is stored in the database."
      >
        <ol className="list-decimal space-y-4 pl-5 text-sm marker:font-medium marker:text-muted-foreground">
          <li className="pl-1">
            <p className="font-medium">Create the GA4 property</p>
            <p className="mt-1 text-muted-foreground">
              In <External href="https://analytics.google.com/">Google Analytics</External>, Admin &gt; Create &gt; Property, then
              add a <span className="text-foreground">Web</span> data stream for <span className="text-foreground">https://www.repget.com</span>.
              Copy the <span className="text-foreground">Property ID</span> from Admin &gt; Property settings &gt; Property details. It is a
              number like 123456789, not the &quot;G-&quot; Measurement ID.
            </p>
          </li>
          <li className="pl-1">
            <p className="font-medium">Turn on the Google Analytics Data API</p>
            <p className="mt-1 text-muted-foreground">
              In <External href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com">Google Cloud</External>,
              choose the project that holds RepGet&apos;s Google sign-in and press Enable.
            </p>
          </li>
          <li className="pl-1">
            <p className="font-medium">Create a service account and a JSON key</p>
            <p className="mt-1 text-muted-foreground">
              In the same project:{" "}
              <External href="https://console.cloud.google.com/iam-admin/serviceaccounts">IAM &amp; Admin &gt; Service accounts</External>{" "}
              &gt; Create service account (a name such as &quot;repget-analytics&quot;; no roles needed). Open it, then Keys &gt; Add key &gt;
              Create new key &gt; JSON. A .json file downloads. Keep it private, like a password.
            </p>
          </li>
          <li className="pl-1">
            <p className="font-medium">Give the service account read access to the property</p>
            <p className="mt-1 text-muted-foreground">
              In Google Analytics, Admin &gt; Property access management &gt; + &gt; Add users. Enter the service account&apos;s address
              {email ? (
                <>
                  {" "}
                  (<code className="rounded bg-muted px-1 text-xs text-foreground select-all">{email}</code>)
                </>
              ) : (
                <> (it ends in .iam.gserviceaccount.com)</>
              )}
              , choose the <span className="text-foreground">Viewer</span> role, and turn off &quot;Notify by email&quot;.
            </p>
          </li>
          <li className="pl-1">
            <p className="font-medium">Add two environment variables in Vercel, then redeploy</p>
            <p className="mt-1 text-muted-foreground">
              Project &gt; Settings &gt; Environment Variables, for Production:{" "}
              <code className="rounded bg-muted px-1 text-xs text-foreground">{PROPERTY_VAR}</code> = the Property ID, and{" "}
              <code className="rounded bg-muted px-1 text-xs text-foreground">{KEY_VAR}</code> = the whole content of the .json file. Then
              redeploy, because a running deployment does not pick up new variables. Then reload this page.
            </p>
          </li>
        </ol>
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          The visits themselves are recorded by the tag on the public pages, which also needs{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_GA4_MEASUREMENT_ID</code> and a few settings changed in Google Analytics: see
          docs/site-analytics.md. A new property needs up to 24-48 hours before its first full day shows here.
        </p>
      </AdminSection>

      <AdminSection title="This deployment" description="What the server can see now." bodyClassName="p-0">
        <ul className="divide-y">
          <VariableStatus
            name={PROPERTY_VAR}
            state={propertyState}
            detail={
              propertyState === "invalid"
                ? invalid!.reason
                : setup.propertyId
                  ? `Property ${setup.propertyId}`
                  : "The GA4 property's number."
            }
          />
          <VariableStatus
            name={KEY_VAR}
            state={keyState}
            detail={
              keyState === "invalid"
                ? invalid!.reason
                : email
                  ? `Service account ${email}`
                  : "The service account's JSON key."
            }
          />
        </ul>
      </AdminSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Failed                                                              */
/* ------------------------------------------------------------------ */

const API_LIBRARY = "https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com";

export function TrafficError({ result }: { result: Extract<SiteTrafficResult, { status: "error" }> }) {
  const address = (
    <code className="rounded bg-muted px-1 text-xs text-foreground select-all [overflow-wrap:anywhere]">{result.clientEmail}</code>
  );
  const copy: Record<typeof result.kind, { title: string; body: ReactNode }> = {
    auth: {
      title: "Google refused the service account key",
      body: (
        <>
          The key was deleted or disabled in Google Cloud, or its service account no longer exists. Create a new JSON key for {address}, put it
          in <code className="text-xs">{KEY_VAR}</code>, and redeploy.
        </>
      ),
    },
    api_disabled: {
      title: "The Google Analytics Data API is turned off",
      body: (
        <>
          Enable it in the Google Cloud project that owns {address}:{" "}
          <External href={result.enableUrl ?? API_LIBRARY}>enable the API</External>. It can take a few minutes to apply.
        </>
      ),
    },
    no_access: {
      title: `The service account cannot read property ${result.propertyId}`,
      body: (
        <>
          In Google Analytics, Admin &gt; Property access management, add {address} with the Viewer role. Also check that{" "}
          <code className="text-xs">{PROPERTY_VAR}</code> is this property&apos;s number.
        </>
      ),
    },
    not_found: {
      title: `Property ${result.propertyId} was not found`,
      body: (
        <>
          Check <code className="text-xs">{PROPERTY_VAR}</code>: Admin &gt; Property settings &gt; Property details &gt; Property ID.
        </>
      ),
    },
    rate_limited: {
      title: "Google's request limit for this property was reached",
      body: <>Google resets it within the hour. Try again later.</>,
    },
    invalid_request: {
      title: "Google rejected the report request",
      body: <>This is a problem in RepGet, not in your Google setup. Google&apos;s message is below.</>,
    },
    unavailable: {
      title: "Google Analytics did not answer",
      body: <>Reload the page to try again. If it keeps failing, check the server logs.</>,
    },
  };
  const { title, body } = copy[result.kind];

  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className="font-medium">{title}</p>
        <p className="text-foreground/80">{body}</p>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">Google said: {result.message}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The report                                                          */
/* ------------------------------------------------------------------ */

function Delta({ value, days }: { value: Change; days: number }) {
  const Icon = value.kind === "up" ? ArrowUpRight : value.kind === "down" ? ArrowDownRight : Minus;
  const compared = value.kind === "up" || value.kind === "down" || value.kind === "flat";
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {compared ? (
          <>
            <span className="font-medium text-foreground">{value.text}</span> vs previous {days} days
          </>
        ) : (
          value.text
        )}
      </span>
    </span>
  );
}

function ChartBlock({ title, total, points, unitLabel }: { title: string; total: number; points: { day: string; value: number }[]; unitLabel: string }) {
  return (
    <figure className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-sm font-medium">{title}</figcaption>
        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums">{count(total)}</span> <span className="text-muted-foreground">in range</span>
        </p>
      </div>
      <LineChart
        points={points}
        label={title}
        unit={{ kind: "count" }}
        unitLabel={unitLabel}
        locale="en"
        noDataLabel="No data"
        dayLabel="Day"
        valueLabel={title}
        instructions="Use the left and right arrow keys to move between days."
        size="compact"
        tone="brand"
      />
    </figure>
  );
}

type BreakdownRow = { key: string; name: ReactNode; value: number; extra?: ReactNode };

/**
 * A ranked list: the name with a one-hue bar for its share of the period's
 * total, the figure, and the share in words, so nothing is read from the bar
 * alone.
 */
function Breakdown({
  title,
  description,
  nameLabel,
  valueLabel,
  extraLabel,
  rows,
  total,
  empty,
}: {
  title: string;
  description: string;
  nameLabel: string;
  valueLabel: string;
  extraLabel?: string;
  rows: BreakdownRow[];
  total: number;
  empty: string;
}) {
  return (
    <AdminSection title={title} description={description} bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th scope="col" className="h-9 px-5 text-left font-medium">
                  {nameLabel}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  {valueLabel}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  Share
                </th>
                {extraLabel ? (
                  <th scope="col" className="h-9 pr-5 pl-3 text-right font-medium">
                    {extraLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ratio = total > 0 ? Math.min(1, row.value / total) : 0;
                return (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="px-5 py-2.5">
                      <span className="block [overflow-wrap:anywhere]">{row.name}</span>
                      <span className="mt-1.5 block h-1 w-full rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[var(--chart-line)]" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{count(row.value)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{share(ratio)}</td>
                    {extraLabel ? <td className="py-2.5 pr-5 pl-3 text-right tabular-nums">{row.extra}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminSection>
  );
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function TrafficReport({ traffic }: { traffic: SiteTraffic }) {
  const { current, previous, today, days } = traffic;
  const noVisits = current.sessions === 0 && current.views === 0;

  const now = (
    <section aria-labelledby="now-title" className="space-y-3">
      <h2 id="now-title" className="text-base font-semibold">
        Right now
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStat
          label="Active users"
          value={traffic.realtimeUsers === null ? "-" : count(traffic.realtimeUsers)}
          unavailable={traffic.realtimeUsers === null}
          hint="On the site in the last 30 minutes"
        />
        <AdminStat label="Users today" value={count(today.users)} hint={`Since midnight, ${traffic.timeZone} time`} />
        <AdminStat label="Views today" value={count(today.views)} hint={`${count(today.sessions)} sessions. Today is not in the totals below.`} />
      </div>
    </section>
  );

  if (noVisits) {
    return (
      <>
        {now}
        <AdminSection title={`No visits recorded in the last ${days} days`}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Google Analytics answered, but has no visits for {periodText(traffic)}. Usually one of these:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The property is new. Google needs up to 24-48 hours before a full day appears; &quot;Right now&quot; above is live sooner.</li>
              <li>
                <code className="text-xs">NEXT_PUBLIC_GA4_MEASUREMENT_ID</code> is not set in this deployment (then there is no tag and no
                cookie banner), or no visitor has accepted analytics cookies yet.
              </li>
              <li>
                <code className="text-xs">{PROPERTY_VAR}</code> points at a different property from the one the tag sends to.
              </li>
            </ul>
          </div>
        </AdminSection>
      </>
    );
  }

  return (
    <>
      {now}

      <section aria-labelledby="period-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="period-title" className="text-base font-semibold">
            Last {days} days
          </h2>
          <p className="text-xs text-muted-foreground">
            {periodText(traffic)}. Compared with the {days} days before.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <AdminStat label="Users" value={count(current.users)} hint={<Delta value={change(current.users, previous.users)} days={days} />} />
          <AdminStat label="New users" value={count(current.newUsers)} hint={<Delta value={change(current.newUsers, previous.newUsers)} days={days} />} />
          <AdminStat label="Sessions" value={count(current.sessions)} hint={<Delta value={change(current.sessions, previous.sessions)} days={days} />} />
          <AdminStat label="Views" value={count(current.views)} hint={<Delta value={change(current.views, previous.views)} days={days} />} />
          <AdminStat
            label="Engagement rate"
            value={percent(current.engagementRate)}
            hint={<Delta value={change(current.engagementRate, previous.engagementRate, { points: true })} days={days} />}
          />
          <AdminStat
            label="Avg. engagement time"
            value={duration(current.engagementSeconds)}
            hint={<Delta value={change(current.engagementSeconds, previous.engagementSeconds)} days={days} />}
          />
        </div>
      </section>

      <AdminSection title="Visits per day" description="Each day in the property's time zone.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartBlock title="Users" unitLabel="users" total={current.users} points={traffic.daily.map((d) => ({ day: d.day, value: d.users }))} />
          <ChartBlock title="Views" unitLabel="views" total={current.views} points={traffic.daily.map((d) => ({ day: d.day, value: d.views }))} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          &quot;Users in range&quot; counts each person once for the whole period, so it is lower than the days added together.
        </p>
      </AdminSection>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Breakdown
          title="Top pages"
          description="Most viewed pages. Addresses are recorded without query strings."
          nameLabel="Page"
          valueLabel="Views"
          extraLabel="Users"
          total={current.views}
          empty="No page views in this period."
          rows={traffic.pages.map((page) => ({
            key: page.path,
            name: <span className="font-mono text-[13px]">{page.path}</span>,
            value: page.views,
            extra: count(page.users),
          }))}
        />
        <Breakdown
          title="How visitors arrive"
          description="Sessions by Google's default channel grouping."
          nameLabel="Channel"
          valueLabel="Sessions"
          extraLabel="Engaged"
          total={current.sessions}
          empty="No sessions in this period."
          rows={traffic.channels.map((channel) => ({
            key: channel.name,
            name: channel.name,
            value: channel.sessions,
            extra: percent(channel.engagementRate),
          }))}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Breakdown
          title="Top sources"
          description="Where sessions came from: source / medium."
          nameLabel="Source / medium"
          valueLabel="Sessions"
          total={current.sessions}
          empty="No sessions in this period."
          rows={traffic.sources.map((source) => ({
            key: `${source.source}|${source.medium}`,
            name: `${source.source} / ${source.medium}`,
            value: source.sessions,
          }))}
        />
        <Breakdown
          title="Countries"
          description="Users by country."
          nameLabel="Country"
          valueLabel="Users"
          total={current.users}
          empty="No users in this period."
          rows={traffic.countries.map((country) => ({ key: country.name, name: country.name, value: country.users }))}
        />
        <Breakdown
          title="Devices"
          description="Users by device type."
          nameLabel="Device"
          valueLabel="Users"
          total={current.users}
          empty="No users in this period."
          rows={traffic.devices.map((device) => ({ key: device.name, name: capitalise(device.name), value: device.users }))}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Property {traffic.propertyId}. Google Analytics processes visits in batches, so the most recent hours can be missing.
        {traffic.thresholded ? " Google withheld some rows to protect individual visitors' privacy, so small figures may be lower than real." : ""}
      </p>
    </>
  );
}
