import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Info,
  PauseCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOperations, type UnresolvedDispatch } from "@/lib/admin/network-operations";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import type { ControlState } from "@/lib/publishing/controls";
import type { ClickValueMode, ValuationPolicy } from "@/lib/valuation/policy";
import { cn } from "@/lib/utils";

import { ExpandableText } from "../../_ui/expandable-text";
import { AdminFacts, AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../../_ui/page";
import { AdminStatus, UnknownIcon, type StatusTone } from "../../_ui/status";
import { AdminEmpty } from "../../_ui/states";
import { AdminTableCard } from "../../_ui/table";
import { CollectAuthorityButton, ControlToggle, PolicyForm, ResolveDispatchForm } from "./operations-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Network Operations" };

const n = (value: number) => formatNumber(value, "en");
const day = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const when = (date: Date | null) =>
  date
    ? `${formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
    : "never";

/** A rate in the policy's own currency; the raw figure if the code is not one Intl knows. */
function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 4 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * Every unknown outcome gets its own word: a send still in its lease is not
 * the same as one whose lease ran out, and neither is a confirmed result.
 */
const DISPATCH_STATE: Record<UnresolvedDispatch["state"], { tone: StatusTone; label: string; icon?: LucideIcon; title: string }> = {
  in_flight: { tone: "pending", label: "In flight", title: "Being sent now - claimed within the last 10 minutes." },
  in_flight_stale: {
    tone: "warning",
    label: "Lease ran out",
    icon: UnknownIcon,
    title: "Claimed more than 10 minutes ago and no outcome was recorded. Outcome unknown.",
  },
  uncertain: { tone: "warning", label: "Uncertain", icon: UnknownIcon, title: "A direct send whose outcome is not known." },
  expired: {
    tone: "danger",
    label: "Unacknowledged",
    icon: UnknownIcon,
    title: "A hand-over that expired or was abandoned without a report. Outcome unknown.",
  },
};

/**
 * domain_metrics.status as STORED, in reading order: done, waiting, answered
 * empty, failed. Keyed on the column's values ("pending"), not on the derived
 * per-site states in lib/authority/metric.ts ("collecting", "not_configured"),
 * because this page counts the raw rows.
 */
const AUTHORITY_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "Collected" },
  pending: { tone: "pending", label: "Waiting for collection" },
  no_data: { tone: "neutral", label: "No data" },
  no_access: { tone: "danger", label: "No access" },
  error: { tone: "danger", label: "Failed" },
};

const TRAFFIC_MODE: Record<ClickValueMode, string> = {
  none: "Not valued",
  keyword_cpc: "Keyword CPC",
  fixed: "Fixed rate per click",
};

/**
 * Partner Network operations: the publication freeze and the managed-review
 * switch, delivery outcomes, Domain Authority collection and the valuation
 * policy. See docs/managed-network.md for when each is used.
 *
 * Reading this page changes nothing: getOperations only selects. Every
 * change is an explicit, confirmed action with a reason.
 */
export default async function NetworkOperationsPage() {
  const ops = await getOperations();
  const control = (key: string) => ops.controls.find((c) => c.key === key)!;
  const freeze = control("publication_freeze");
  const review = control("managed_review");

  const { drain, authority, policy, policies, unresolved } = ops;
  const openTotal = drain.inFlight + drain.inFlightStale + drain.uncertain + drain.unacknowledged;

  // The version in force is the newest one whose day has come; anything that
  // starts later than it is scheduled. With nothing in force, all are scheduled.
  const scheduled = (p: ValuationPolicy) => p.id !== policy?.id && (!policy || p.effectiveFrom > policy.effectiveFrom);
  const upcoming = policies.filter(scheduled);

  const collectBlocked = !authority.configured
    ? "Credentials are not configured on this deployment."
    : authority.dailyLimit.source === "invalid" || authority.dailyLimit.source === "disabled"
      ? "Collection is disabled by the daily request limit."
      : null;

  const statuses = Object.entries(authority.byStatus).sort(([a], [b]) => {
    const order = Object.keys(AUTHORITY_STATUS);
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Network Operations"
        description="Publishing switches, delivery outcomes, Domain Authority collection and the valuation policy. Every change is recorded in the audit log."
        actions={
          <Button variant="outline" size="lg" asChild>
            <Link href="/admin/network">
              <ClipboardCheck aria-hidden="true" />
              Review queue
            </Link>
          </Button>
        }
      />

      {/* Monitoring: what publishing is doing right now. Read-only. */}
      <section aria-labelledby="status-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="status-title" className="text-base font-semibold">
            Publishing status
          </h2>
          <p className="text-xs text-muted-foreground">Read-only. Switches and decisions are in the sections below.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StateTile
            label="Publication freeze"
            highlight={freeze.enabled ? "warning" : undefined}
            status={
              freeze.enabled ? (
                <AdminStatus tone="warning" icon={PauseCircle} label="On - nothing is sent" className="px-2.5 py-1 text-sm" />
              ) : (
                <AdminStatus tone="neutral" label="Off" className="px-2.5 py-1 text-sm" />
              )
            }
            detail={freeze.enabled ? "No publishing path sends anything to customer sites." : "Publishing is not held."}
            foot={<LastChange control={freeze} />}
          />
          <StateTile
            label="Managed review"
            highlight={review.enabled ? "info" : undefined}
            status={
              review.enabled ? (
                <AdminStatus tone="info" icon={ShieldCheck} label="On" className="px-2.5 py-1 text-sm" />
              ) : (
                <AdminStatus tone="neutral" label="Off" className="px-2.5 py-1 text-sm" />
              )
            }
            detail={
              review.enabled
                ? "New Partner Network drafts wait for the RepGet team's review."
                : "New drafts are not held for review."
            }
            foot={<LastChange control={review} />}
          />
          <StateTile
            label="Delivery drain"
            highlight={drain.drained ? undefined : "danger"}
            status={
              drain.drained ? (
                <AdminStatus tone="success" label="Drained" className="px-2.5 py-1 text-sm" />
              ) : (
                <AdminStatus tone="danger" icon={AlertTriangle} label="Not drained" className="px-2.5 py-1 text-sm" />
              )
            }
            detail={
              drain.drained
                ? "No delivery has an unknown outcome."
                : "Resolve every attempt under Unresolved deliveries before switching builds."
            }
          />
          <AdminStat
            label="Unresolved deliveries"
            value={<span className="tabular-nums">{n(openTotal)}</span>}
            href="#unresolved"
            hint={
              openTotal === 0
                ? "Every delivery attempt has a known outcome."
                : (
                    [
                      [drain.uncertain, "uncertain"],
                      [drain.unacknowledged, "unacknowledged"],
                      [drain.inFlightStale, "lease ran out"],
                      [drain.inFlight, "in flight"],
                    ] as const
                  )
                    .filter(([count]) => count > 0)
                    .map(([count, word]) => `${n(count)} ${word}`)
                    .join(" · ")
            }
          />
        </div>
      </section>

      {/* Delivery outcomes: the list behind "drained", oldest claim first. */}
      <section id="unresolved" aria-labelledby="unresolved-title" className="scroll-mt-20">
        <AdminTableCard
          toolbar={
            <div className="border-b">
              <div className="space-y-1 px-5 py-4">
                <h2 id="unresolved-title" className="text-base font-semibold">
                  Unresolved deliveries
                </h2>
                <p className="max-w-4xl text-sm text-muted-foreground">
                  Attempts whose outcome is not known, oldest claim first. An uncertain direct send is looked up automatically by its
                  ownership marker and adopted only when exactly one post carries it; an empty lookup is not proof. An expired hand-over
                  from a plugin older than 1.6.0 blocks newer revisions of that article until the plugin reports it or it is released
                  here.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4">
                <DrainCount label="In flight" value={drain.inFlight} hint="Claimed in the last 10 minutes" />
                <DrainCount label="Lease ran out, no outcome" value={drain.inFlightStale} attention />
                <DrainCount label="Uncertain direct sends" value={drain.uncertain} attention />
                <DrainCount label="Unacknowledged plugin hand-overs" value={drain.unacknowledged} attention />
              </dl>
              {/* Drained means the list below is empty, which its empty state says; only the opposite needs a banner. */}
              {drain.drained ? null : (
                <div className="flex items-start gap-2 border-t bg-danger-soft px-5 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  <p className="font-medium text-danger">Not drained: resolve every attempt listed below before switching builds.</p>
                </div>
              )}
            </div>
          }
          footer={
            unresolved.length > 0 && openTotal > unresolved.length ? (
              <p className="text-sm tabular-nums text-muted-foreground">
                Showing {n(unresolved.length)} of {n(openTotal)} open attempts, oldest claim first (at most 50 are listed).
              </p>
            ) : undefined
          }
        >
          {unresolved.length === 0 ? (
            // The list joins each attempt to its article and website; the counts do not, so the two can differ.
            drain.drained ? (
              <AdminEmpty
                filtering={false}
                icon={CheckCircle2}
                title="Drained: no unresolved deliveries"
                description="No delivery has an unknown outcome."
                noun="deliveries"
              />
            ) : (
              <AdminEmpty
                filtering={false}
                icon={AlertTriangle}
                title="Open attempts could not be listed"
                description="The counts above include attempts whose article or website could not be found, so none can be shown or resolved here."
                noun="deliveries"
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="hidden md:table-cell">Website and channel</TableHead>
                  <TableHead className="hidden xl:table-cell">Outcome</TableHead>
                  <TableHead className="hidden sm:table-cell">Claimed</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Lookups</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unresolved.map((d) => {
                  const state = DISPATCH_STATE[d.state];
                  const channel = `${d.channel}${d.protocol ? ` (${d.protocol})` : ""}`;
                  const kind = d.state === "uncertain" ? "uncertain" : d.state === "expired" && d.channel === "plugin" ? "expired" : null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="min-w-40 whitespace-normal">
                        <Link
                          href={`/admin/articles/${d.articleId}`}
                          className="line-clamp-2 rounded-sm font-medium outline-none wrap-anywhere hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {d.articleTitle}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">
                          <span className="md:hidden">{d.domain} · </span>
                          <span className="md:hidden">{channel} · </span>
                          <span className="sm:hidden">claimed {when(d.claimedAt)} · </span>
                          <span className="font-mono text-[11px]">{d.id}</span>
                        </p>
                        {/* Below xl (beside the sidebar) the outcome column is hidden; the outcome goes under the title. */}
                        <div className="mt-1.5 xl:hidden">
                          <AdminStatus tone={state.tone} label={state.label} icon={state.icon} title={state.title} />
                        </div>
                      </TableCell>
                      {/*
                        Website and channel share a cell: as separate columns, with
                        the sidebar open, the row was wider than the card at 1280px
                        and the Decision button sat behind a sideways scroll.
                      */}
                      <TableCell className="hidden max-w-[16rem] md:table-cell">
                        <ExpandableText text={d.domain} />
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {d.channel}
                          {d.protocol ? <span className="ml-1 font-mono text-[11px]">({d.protocol})</span> : null}
                        </span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <AdminStatus tone={state.tone} label={state.label} icon={state.icon} title={state.title} />
                      </TableCell>
                      <TableCell className="hidden min-w-28 whitespace-normal tabular-nums text-muted-foreground sm:table-cell">{when(d.claimedAt)}</TableCell>
                      <TableCell className="hidden whitespace-normal 2xl:table-cell">
                        {d.lookupAttempts ? (
                          <>
                            <span className="tabular-nums">
                              {n(d.lookupAttempts)} {d.lookupAttempts === 1 ? "lookup" : "lookups"}
                            </span>
                            <span className="block text-xs text-muted-foreground wrap-anywhere">last: {d.lookupResult ?? "-"}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">None yet</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {kind ? (
                          <ResolveDispatchForm
                            dispatchId={d.id}
                            kind={kind}
                            articleTitle={d.articleTitle}
                            domain={d.domain}
                            channel={channel}
                            claimed={when(d.claimedAt)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Waiting for its outcome.</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </AdminTableCard>
      </section>

      {/* Actions: the two switches that change what every customer's publishing does. */}
      <AdminSection
        id="switches"
        tone="danger"
        title="Platform switches"
        description="These change what publishing does for every customer. Each change asks for confirmation and a reason, and is recorded in the audit log."
        bodyClassName="p-0"
      >
        <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex flex-col gap-4 p-5" id="freeze">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Publication freeze</h3>
              {freeze.enabled ? (
                <AdminStatus tone="warning" icon={PauseCircle} label="On - nothing is sent" />
              ) : (
                <AdminStatus tone="neutral" label="Off" />
              )}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
              <li>
                While on, no publishing path sends anything to a customer site: direct publishing, the plugin feed, scheduled and
                queued jobs all hold at their dispatch claim.
              </li>
              <li>Turning it on waits for claims already being made, so it can take a while to return.</li>
              <li>
                Sends already admitted cannot be recalled: their outcome must be known (see Delivery drain) before switching builds -
                follow the rollback procedure.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              <LastChange control={freeze} />
            </p>
            <div className="mt-auto">
              <ControlToggle controlKey="publication_freeze" enabled={freeze.enabled} title="Publication freeze" onLabel="on" offLabel="off" />
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5" id="review">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Managed review</h3>
              {review.enabled ? (
                <AdminStatus tone="info" icon={ShieldCheck} label="On" />
              ) : (
                <AdminStatus tone="neutral" label="Off" />
              )}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
              <li>While on, new drafts on Partner Network websites wait for the RepGet team&apos;s review.</li>
              <li>
                Turning it on also holds the unpublished drafts written on those websites since this build&apos;s cutover.
              </li>
              <li>
                Turn on only after a deploy has finished, so no older build that ignores the review gate is still running.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              <LastChange control={review} />
            </p>
            <div className="mt-auto">
              <ControlToggle controlKey="managed_review" enabled={review.enabled} title="Managed review" onLabel="on" offLabel="off" />
            </div>
          </div>
        </div>
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection
          id="authority"
          title="Domain Authority collection"
          description="Collected in the background, capped per day by AUTHORITY_DAILY_REQUESTS and reserved before each request. Page views never call the provider."
          actions={<CollectAuthorityButton disabled={collectBlocked !== null} />}
        >
          <div className="space-y-4 text-sm">
            {collectBlocked && authority.configured ? (
              <p className="text-xs text-muted-foreground">Collect now is unavailable: {collectBlocked}</p>
            ) : authority.configured ? (
              <p className="text-xs text-muted-foreground">
                Collect now asks for one background run; repeated requests within 10 minutes start the same run.
              </p>
            ) : null}
            {!authority.configured ? (
              <Callout tone="warning" icon={AlertTriangle}>
                Domain Authority credentials are not configured on this deployment, so nothing is collected.
              </Callout>
            ) : (
              <>
                {authority.byStatus.no_access ? (
                  <Callout tone="danger" icon={AlertTriangle}>
                    The provider answered 40204 (no access to backlink data) for the configured account. Enabling access is an operator
                    decision made in the provider account - nothing is purchased from here. Collection retries weekly.
                  </Callout>
                ) : null}
                <AdminFacts
                  items={[
                    { label: "Metric", value: authority.metric },
                    {
                      label: "Daily request limit",
                      value:
                        authority.dailyLimit.source === "invalid" ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <AdminStatus tone="danger" label="Invalid" />
                            <span className="text-danger">
                              AUTHORITY_DAILY_REQUESTS is not a whole number - collection is disabled until it is fixed
                            </span>
                          </span>
                        ) : authority.dailyLimit.source === "disabled" ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <AdminStatus tone="warning" label="Disabled" />
                            <span>0 - collection disabled (AUTHORITY_DAILY_REQUESTS=0)</span>
                          </span>
                        ) : (
                          <span className="tabular-nums">
                            {n(authority.dailyLimit.limit)} per day
                            {authority.dailyLimit.source === "default" ? (
                              <span className="text-muted-foreground"> (default)</span>
                            ) : null}
                          </span>
                        ),
                    },
                    {
                      label: "Last attempt",
                      value: (
                        <div className="space-y-1">
                          <p className="tabular-nums">{when(authority.lastAttemptAt)}</p>
                          {authority.lastError ? (
                            <span className="flex flex-wrap items-start gap-2">
                              <AdminStatus tone="danger" label="Error" />
                              <span className="min-w-0 text-muted-foreground wrap-anywhere">{authority.lastError}</span>
                            </span>
                          ) : authority.lastAttemptAt ? (
                            <p className="text-xs text-muted-foreground">No error recorded.</p>
                          ) : null}
                        </div>
                      ),
                    },
                  ]}
                />
                <div className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-medium">Domains by status</h3>
                  {statuses.length === 0 ? (
                    <p className="text-muted-foreground">No domains tracked yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {statuses.map(([status, count]) => {
                        const known = AUTHORITY_STATUS[status];
                        return (
                          <li key={status} className="flex items-center justify-between gap-3 px-3 py-2">
                            <AdminStatus
                              tone={known?.tone ?? "neutral"}
                              label={known?.label ?? status}
                              icon={known ? undefined : UnknownIcon}
                              title={`Status "${status}"`}
                            />
                            <span className="font-medium tabular-nums">{n(count)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </AdminSection>

        <AdminSection
          id="valuation"
          title="Valuation policy"
          description="Customers see an estimated equivalent value only under a published policy. Versions are append-only; the newest one whose day has come is in force."
          actions={
            policy ? <AdminStatus tone="success" label={`v${policy.version} in force`} /> : <AdminStatus tone="warning" label="None in force" />
          }
        >
          <div className="space-y-4 text-sm">
            {policy ? (
              <AdminFacts
                items={[
                  { label: "In force", value: `v${policy.version} (${policy.currency}) since ${day(policy.effectiveFrom)}` },
                  {
                    label: "Traffic",
                    value:
                      policy.clickValueMode === "fixed"
                        ? `${TRAFFIC_MODE.fixed}: ${policy.fixedClickRate === null ? "no rate set" : `${money(policy.fixedClickRate, policy.currency)} per click`}`
                        : TRAFFIC_MODE[policy.clickValueMode],
                  },
                  {
                    label: "Backlinks",
                    value:
                      policy.backlinkRates.length === 0 ? (
                        "Not valued"
                      ) : (
                        <ul className="space-y-0.5">
                          {policy.backlinkRates.map((rate, i) => (
                            <li key={`${i}-${rate.minRank ?? "unknown"}`} className="tabular-nums">
                              {rate.minRank === null ? "Unknown authority" : `Domain Authority ${rate.minRank}+`}:{" "}
                              <span className="font-medium">{money(rate.value, policy.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      ),
                  },
                  { label: "Sources", value: <span className="whitespace-pre-line">{policy.sources}</span> },
                ]}
              />
            ) : (
              <Callout tone="warning" icon={Info}>
                No policy in force: customers see &quot;Estimate not configured&quot;.
              </Callout>
            )}

            {upcoming.length > 0 ? (
              <Callout tone="info" icon={CalendarClock}>
                Scheduled:{" "}
                {upcoming.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 ? "; " : ""}v{p.version} ({p.currency}) from {day(p.effectiveFrom)}
                  </span>
                ))}
                .
              </Callout>
            ) : null}

            {policies.length > 0 ? (
              <details className="border-t pt-4">
                <summary className="cursor-pointer rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  All versions ({n(policies.length)}
                  {policies.length >= 50 ? ", newest 50" : ""})
                </summary>
                <ul className="mt-3 divide-y rounded-lg border">
                  {policies.map((p) => {
                    const inForce = p.id === policy?.id;
                    const later = scheduled(p);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                        <span className="min-w-0 tabular-nums">
                          <span className="font-medium">v{p.version}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {p.currency} · from {day(p.effectiveFrom)} · by {p.createdBy ?? "-"}
                          </span>
                        </span>
                        {inForce ? (
                          <AdminStatus tone="success" label="In force" />
                        ) : later ? (
                          <AdminStatus tone="info" icon={CalendarClock} label="Scheduled" />
                        ) : (
                          <AdminStatus tone="neutral" label="Superseded" icon={null} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        id="publish-policy"
        title="Publish a new valuation policy version"
        description="Do not enter market prices you cannot source. Rates and their sources are shown to customers."
      >
        <PolicyForm
          current={
            policy
              ? {
                  currency: policy.currency,
                  clickValueMode: policy.clickValueMode,
                  fixedClickRate: policy.fixedClickRate,
                  bands: policy.backlinkRates.map((r) => `${r.minRank ?? "unknown"}:${r.value}`).join(", "),
                  sources: policy.sources,
                }
              : null
          }
        />
      </AdminSection>
    </AdminPage>
  );
}

/** "Changed {when} by {who} - {reason}", or that it never was. */
function LastChange({ control }: { control: ControlState }) {
  if (!control.updatedAt) return <>Never changed - off unless switched on here.</>;
  return (
    <span className="wrap-anywhere">
      Last change: {when(control.updatedAt)} by {control.updatedBy ?? "-"}
      {control.reason ? ` - ${control.reason}` : ""}
    </span>
  );
}

/** One switch or verdict at a glance: what it is, its state as icon + word, what that means. */
function StateTile({
  label,
  status,
  detail,
  foot,
  highlight,
}: {
  label: string;
  status: ReactNode;
  detail: ReactNode;
  foot?: ReactNode;
  highlight?: "warning" | "info" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        highlight === "warning" && "border-warning/40",
        highlight === "info" && "border-info/30",
        highlight === "danger" && "border-danger/35",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2">{status}</div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      {foot ? <p className="mt-auto pt-2 text-xs text-muted-foreground">{foot}</p> : null}
    </div>
  );
}

function DrainCount({ label, value, hint, attention }: { label: string; value: number; hint?: string; attention?: boolean }) {
  return (
    <div className="bg-card px-5 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums", attention && value > 0 && "text-danger")}>
        {n(value)}
        {hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

function Callout({
  tone,
  icon: Icon,
  children,
}: {
  tone: "warning" | "danger" | "info";
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        tone === "warning" && "border-warning/30 bg-warning-soft",
        tone === "danger" && "border-danger/25 bg-danger-soft",
        tone === "info" && "border-info/25 bg-info-soft",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "info" && "text-info",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 text-foreground/85 wrap-anywhere">{children}</div>
    </div>
  );
}

