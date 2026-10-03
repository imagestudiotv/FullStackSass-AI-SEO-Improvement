import { ArrowUpRight, ScrollText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminActions, listAuditActors, type AuditRow } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { DATE_RANGES, pageFrom, sinceFrom } from "@/lib/admin/shared";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { ExpandableText } from "../_ui/expandable-text";
import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminTableCard } from "../_ui/table";
import { AdminToolbar, type ToolbarFilterOption } from "../_ui/toolbar";
import { Pagination, pageHref } from "../pagination";
import {
  ACTION_OPTIONS,
  actionMeta,
  targetLabel,
  targetLink,
  type TargetLink,
} from "./action-meta";

export const metadata = { title: "Activity" };

export const dynamic = "force-dynamic";

const BASE = "/admin/activity";
const n = (value: number) => formatNumber(value, "en");
const day = (value: Date) =>
  formatDate(value, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** hh:mm:ss in UTC, read off the ISO string: exact, and identical wherever it renders. */
const clock = (value: Date) => value.toISOString().slice(11, 19);

/** A query value, with a missing or empty one meaning "no filter" - the same as the query treats it. */
const param = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : "all";

/**
 * A value in the URL that no option offers (typed by hand, or an actor or
 * code from elsewhere) still reaches the query, so the control shows it
 * rather than a blank box that hides an active filter.
 */
function withCurrent(options: ToolbarFilterOption[], current: string, label: string): ToolbarFilterOption[] {
  return current === "all" || options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label }];
}

/**
 * What administrators have done.
 *
 * The counterpart to the actions themselves: refunds, credit adjustments and
 * deactivations all write here before they touch anything. This page is the
 * reason a dispute about whether a refund was issued has an answer.
 *
 * Read-only by design. There is no control to remove an entry, because a log
 * that can be tidied proves nothing.
 */
export default async function AdminActivityPage({
  searchParams,
}: PageProps<"/admin/activity">) {
  /**
   * Guarded here as well as in the layout. A layout does not re-run on
   * client-side navigation under partial rendering, and this page lists every
   * operator action across every workspace. The audit reads below have no
   * guard of their own - this call is the only one.
   */
  await requireAdmin();

  const params = await searchParams;
  const actor = param(params.actor);
  const action = param(params.action);
  const when = param(params.when);
  const page = pageFrom(params.page);

  const [{ rows, total, pageSize }, actors] = await Promise.all([
    listAdminActions({ page, actor, action, since: sinceFrom(when) }),
    /**
     * The actor list comes from the log itself, not from ADMIN_EMAILS: the
     * allowlist is who can act now, while this is who did act. Someone removed
     * from the allowlist still has entries, and filtering by them must stay
     * possible.
     */
    listAuditActors(),
  ]);

  /** The list's own parameters, carried by pagination. */
  const listParams = {
    actor: actor !== "all" ? actor : undefined,
    action: action !== "all" ? action : undefined,
    when: when !== "all" ? when : undefined,
  };
  // An unrecognised range is ignored by the query, so it does not count as filtering.
  const knownRange = DATE_RANGES.some((range) => range.value === when);
  const filtering = actor !== "all" || action !== "all" || (when !== "all" && knownRange);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  // A page number past the end (an old link, a narrower filter): the entries exist, just not here.
  const pastTheEnd = rows.length === 0 && total > 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Activity"
        description="Every change an administrator has made, newest first, with times in UTC. Entries are never edited or removed."
      />

      <AdminToolbar
        resultLabel={`${n(total)} ${total === 1 ? "entry" : "entries"}`}
        filters={[
          {
            param: "actor",
            label: "Who",
            allValue: "all",
            options: withCurrent(
              [{ value: "all", label: "Anyone" }, ...actors.map((email) => ({ value: email, label: email }))],
              actor,
              actor,
            ),
          },
          {
            param: "action",
            label: "Action",
            allValue: "all",
            // Every code AdminAction can hold, labelled - not a hand-picked subset.
            options: withCurrent([{ value: "all", label: "Any action" }, ...ACTION_OPTIONS], action, action),
          },
          {
            param: "when",
            label: "When",
            allValue: "all",
            options: withCurrent(
              DATE_RANGES.map((range) => ({ ...range })),
              when,
              `"${when}" (not a range - ignored)`,
            ),
          },
        ]}
      />

      <AdminTableCard
        footer={
          rows.length > 0 ? (
            <Pagination page={page} pageSize={pageSize} total={total} params={listParams} basePath={BASE} />
          ) : undefined
        }
      >
        {pastTheEnd ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <ScrollText className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">This page is past the end of the log</p>
            <p className="mt-1 max-w-sm text-sm tabular-nums text-muted-foreground">
              {n(total)} {total === 1 ? "entry" : "entries"}, on {n(lastPage)} {lastPage === 1 ? "page" : "pages"}.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href={pageHref(BASE, listParams, lastPage)}>Go to the last page</Link>
            </Button>
          </div>
        ) : rows.length === 0 ? (
          /*
            Two different empty states. "Nothing recorded yet" under an
            active filter is a lie that sends an operator looking for a bug
            in the log rather than widening their filter.
          */
          <AdminEmpty
            filtering={filtering}
            icon={ScrollText}
            noun="entries"
            title="Nothing recorded yet"
            description="Refunds, credit adjustments, deletions and other administrator changes appear here as they happen."
            clearHref={BASE}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead className="hidden md:table-cell">Who</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="hidden xl:table-cell">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ActivityRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        )}
      </AdminTableCard>
    </AdminPage>
  );
}

function ActivityRow({ row }: { row: AuditRow }) {
  const meta = actionMeta(row.action);
  const Icon = meta.icon;
  const target = targetLabel(row.targetType);
  const link = targetLink(row);

  return (
    <TableRow>
      <TableCell>
        <time dateTime={row.createdAt.toISOString()} className="block tabular-nums">
          <span className="block">{day(row.createdAt)}</span>
          <span className="block text-xs text-muted-foreground">{clock(row.createdAt)} UTC</span>
        </time>
      </TableCell>

      <TableCell className="hidden text-muted-foreground md:table-cell">
        {/* A floor, so an expanded long address wraps in a readable column rather than one letter per line. */}
        <div className="min-w-40">
          <ExpandableText text={row.actorEmail} threshold={26} className="max-w-52" />
        </div>
      </TableCell>

      {/*
        The summary is written for a person at the time of the action, so it
        reads without the code beside it; the label above it names the kind of
        action. Plain text: it carries operator-typed reasons and customer
        names. This column takes the remaining width (w-full max-w-0), so a
        long summary truncates to one line until opened instead of widening
        the table.
      */}
      <TableCell className="w-full max-w-0 whitespace-normal">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className={cn("size-3.5 shrink-0", meta.removal && "text-danger")} aria-hidden="true" />
          <span className="truncate">{meta.label}</span>
        </p>
        <div className="mt-0.5 text-foreground">
          <ExpandableText text={row.summary} threshold={140} />
        </div>
        {/* On narrower screens the hidden columns' facts sit under the summary: who (below md) and the target (below xl). */}
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground xl:hidden">
          <span className="wrap-anywhere md:hidden">by {row.actorEmail}</span>
          <span className="md:hidden" aria-hidden="true">
            ·
          </span>
          {link ? <TargetAnchor label={target} link={link} /> : <span>{target}</span>}
        </p>
      </TableCell>

      <TableCell className="hidden xl:table-cell">
        <div className="min-w-32">
          {link ? <TargetAnchor label={target} link={link} /> : <span>{target}</span>}
          {row.targetId ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              <ExpandableText text={row.targetId} mono threshold={22} className="max-w-40 text-xs" />
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** The target, linked to the admin page where it is handled. */
function TargetAnchor({ label, link }: { label: string; link: TargetLink }) {
  return (
    <Link
      href={link.href}
      title={`Open ${link.destination}`}
      aria-label={`${label}: open ${link.destination}`}
      className="inline-flex items-center gap-0.5 rounded font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
