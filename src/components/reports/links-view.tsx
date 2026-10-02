"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition, type FormEvent } from "react";

import { RankPill } from "@/components/reports/authority-badge";
import { formatValue } from "@/lib/reporting/format";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { format, formatDate, plural } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { getLinkDetail, recheckLink, recoverCredits } from "@/lib/reporting/actions";
import type { CreditState, Direction, LinkDetail, LinkRow, Lifecycle, SortKey, Tab } from "@/lib/reporting/backlinks";
import { cn } from "@/lib/utils";

type Text = Messages["app"]["reports"];

/** Only http(s) addresses become links; anything else is shown as text. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

const LIFECYCLE_BADGE: Record<Lifecycle, { status: string; tone: StatusTone }> = {
  verified: { status: "live", tone: "positive" },
  awaiting_publication: { status: "scheduled", tone: "neutral" },
  awaiting_verification: { status: "publish", tone: "active" },
  not_found: { status: "missing", tone: "warning" },
  removed: { status: "removed", tone: "warning" },
  withdrawn: { status: "cancelled", tone: "neutral" },
  unknown: { status: "pending", tone: "neutral" },
};

export function lifecycleLabel(lifecycle: Lifecycle, t: Text, direction: Direction = "received"): string {
  // Hosted links: nothing is charged to this website - credits are earned, or reversed.
  if (direction === "given" && lifecycle === "not_found") return t.lcNotFoundGiven;
  if (direction === "given" && lifecycle === "removed") return t.lcRemovedGiven;
  switch (lifecycle) {
    case "verified":
      return t.lcVerified;
    case "awaiting_publication":
      return t.lcAwaitingPublication;
    case "awaiting_verification":
      return t.lcAwaitingVerification;
    case "not_found":
      return t.lcNotFound;
    case "removed":
      return t.lcRemoved;
    case "withdrawn":
      return t.lcWithdrawn;
    default:
      return t.lcUnknown;
  }
}

export function LifecycleBadge({ lifecycle, t, direction = "received" }: { lifecycle: Lifecycle; t: Text; direction?: Direction }) {
  const meta = LIFECYCLE_BADGE[lifecycle];
  return <StatusBadge status={meta.status} tone={meta.tone} label={lifecycleLabel(lifecycle, t, direction)} animate={false} />;
}

function creditText(state: CreditState, credits: number, t: Text): { text: string; className: string } {
  switch (state) {
    case "settled":
      return { text: format(t.creditSettled, { n: credits }), className: "text-foreground" };
    case "earned":
      return { text: format(t.creditEarned, { n: credits }), className: "text-emerald-700 dark:text-emerald-400" };
    case "reserved":
      return { text: format(t.creditReserved, { n: credits }), className: "text-muted-foreground" };
    case "pending":
      return { text: format(t.creditPending, { n: credits }), className: "text-muted-foreground" };
    case "refunded":
      return { text: format(t.creditRefunded, { n: credits }), className: "text-muted-foreground" };
    case "reversed":
      return { text: format(t.creditReversed, { n: credits }), className: "text-muted-foreground" };
    default:
      return { text: t.creditNone, className: "text-muted-foreground" };
  }
}

function eventLabel(row: LinkRow, t: Text): string {
  switch (row.eventKind) {
    case "verified":
      return t.eventVerified;
    case "removed":
      return t.eventRemoved;
    case "published":
      return t.eventPublished;
    case "placed":
      return t.eventPlaced;
    default:
      return t.eventUnknown;
  }
}

export type LinksViewProps = {
  websiteId: string;
  direction: Direction;
  rows: LinkRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  tabCounts: Record<Tab, number>;
  query: { tab: Tab; type: string; q: string; from: string; to: string; issue: string | null; sort: SortKey; dir: "asc" | "desc" };
  currency: string | null;
  canEdit: boolean;
  /** Links on this site not found on published articles, for "Recover credits". */
  recoverable: number;
  creditsHref: string | null;
  t: Text;
  locale: Locale;
};

export function LinksView(props: LinksViewProps) {
  const { t, locale, query, direction } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, LinkDetail | { error: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  /** A URL with these params changed. Filters reset the page; `undefined` removes a param. */
  const href = (changes: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage && !("page" in changes)) next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const onFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.push(
      href({
        q: String(form.get("q") ?? "").trim() || undefined,
        from: String(form.get("from") ?? "") || undefined,
        to: String(form.get("to") ?? "") || undefined,
      }),
    );
  };

  const toggle = (id: string) => {
    const open = !expanded[id];
    setExpanded((e) => ({ ...e, [id]: open }));
    if (open && !details[id]) {
      setLoading(id);
      startTransition(async () => {
        const result = await getLinkDetail(props.websiteId, direction, id);
        setDetails((d) => ({ ...d, [id]: result.ok ? result.data : { error: result.error } }));
        setLoading(null);
      });
    }
  };

  const recheck = (id: string) => {
    startTransition(async () => {
      const result = await recheckLink(props.websiteId, direction, id);
      setNotice(result.ok ? (result.data.revived ? t.recheckRevived : t.recheckQueued) : result.error);
      if (result.ok) {
        const fresh = await getLinkDetail(props.websiteId, direction, id);
        if (fresh.ok) setDetails((d) => ({ ...d, [id]: fresh.data }));
        router.refresh();
      }
    });
  };

  const recover = () => {
    startTransition(async () => {
      const result = await recoverCredits(props.websiteId);
      setNotice(result.ok ? plural(t.recoverQueued, result.data.requested, { skipped: result.data.skipped }) : result.error);
      router.refresh();
    });
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "all", label: t.tabAll },
    { key: "verified", label: t.tabVerified },
    { key: "pending", label: t.tabPending },
    { key: "refunded", label: t.tabRefunded },
  ];

  const sortable = (key: SortKey, label: string, className?: string) => {
    const activeSort = query.sort === key;
    const nextDir = activeSort && query.dir === "desc" ? "asc" : "desc";
    return (
      <th
        scope="col"
        aria-sort={activeSort ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-2 text-left text-xs font-medium text-muted-foreground", className)}
      >
        <Link
          href={href({ sort: key, dir: nextDir })}
          className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          scroll={false}
        >
          {label}
          {activeSort ? (
            query.dir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-50" aria-hidden="true" />
          )}
          <span className="sr-only">{activeSort ? (query.dir === "asc" ? t.sortedAsc : t.sortedDesc) : t.sortable}</span>
        </Link>
      </th>
    );
  };

  const firstShown = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const lastShown = Math.min(props.total, props.page * props.pageSize);
  const filtered = Boolean(query.q || query.from || query.to || query.type !== "all" || query.issue);
  const date = (d: Date | string | null) => (d ? formatDate(d, locale, { day: "numeric", month: "short", year: "numeric" }) : t.dateUnknown);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t.statusFilterLabel} className="-mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 px-1">
            {tabs.map((tab) => {
              const active = query.tab === tab.key;
              return (
                <li key={tab.key}>
                  <Link
                    href={href({ tab: tab.key === "all" ? undefined : tab.key })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    scroll={false}
                  >
                    {tab.label}
                    <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-background/20" : "bg-muted")}>{props.tabCounts[tab.key]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="links-type">{t.typeLabel}</label>
          <select
            id="links-type"
            value={query.type}
            onChange={(event) => router.push(href({ type: event.target.value === "all" ? undefined : event.target.value }))}
            className="h-8 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{t.typeAll}</option>
            <option value="managed">{t.typeManaged}</option>
            <option value="exchange">{t.typeExchange}</option>
          </select>
          {props.creditsHref ? (
            <Link href={props.creditsHref} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t.creditActivity} →
            </Link>
          ) : null}
          <span className="text-muted-foreground tabular-nums" aria-live="polite">
            {plural(t.resultCount, props.total, { count: props.total })}
          </span>
          {direction === "given" && props.canEdit && props.recoverable > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={recover} disabled={pending} className="border-sky-300 text-sky-800 dark:text-sky-300">
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {plural(t.recoverFrom, props.recoverable, { count: props.recoverable })}
            </Button>
          ) : null}
        </div>
      </div>

      <form onSubmit={onFilters} className="flex flex-wrap items-end gap-2" role="search" aria-label={t.searchLabel}>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor="links-q" className="text-xs text-muted-foreground">{t.searchLabel}</label>
          <input id="links-q" name="q" type="search" defaultValue={query.q} placeholder={t.searchPlaceholder} maxLength={100} className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="links-from" className="text-xs text-muted-foreground">{t.dateFrom}</label>
          <input id="links-from" name="from" type="date" defaultValue={query.from} className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="links-to" className="text-xs text-muted-foreground">{t.dateTo}</label>
          <input id="links-to" name="to" type="date" defaultValue={query.to} className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <Button type="submit" size="sm" variant="secondary" className="h-9">{t.apply}</Button>
        {filtered ? (
          <Link href={href({ q: undefined, from: undefined, to: undefined, type: undefined, issue: undefined })} className="h-9 content-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t.clearFilters}
          </Link>
        ) : null}
        <p className="basis-full text-xs text-muted-foreground">{t.dateMeaning}</p>
      </form>

      {query.issue === "not_found" || query.issue === "nofollow" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {query.issue === "nofollow"
            ? direction === "given" ? t.issueFilterNofollowGiven : t.issueFilterNofollowReceived
            : direction === "given" ? t.issueFilterGiven : t.issueFilterReceived}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      {/* Table: its own horizontal scroll, never the page's. */}
      <div className="relative overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">{direction === "received" ? t.earnedTitle : t.hostedTitle}</caption>
          <thead className="border-b bg-muted/30">
            <tr>
              {sortable("date", t.colDate, "w-32")}
              {sortable("source", direction === "received" ? t.colLink : t.colDestination)}
              {sortable("authority", t.colAuthority, "w-24")}
              {direction === "received" ? sortable("value", t.colValue, "w-24") : null}
              {sortable("credits", t.colCredits, "w-36")}
              {direction === "received" ? (
                <th scope="col" className="w-24 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  <span title={t.aiCitationHelp}>{t.colAiCitation}</span>
                </th>
              ) : null}
              {sortable("status", t.colStatus, "w-44")}
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">{t.colDetails}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {filtered || query.tab !== "all" ? t.emptyFiltered : direction === "received" ? t.emptyReceived : t.emptyGiven}
                </td>
              </tr>
            ) : null}
            {props.rows.map((row) => {
              const open = Boolean(expanded[row.id]);
              const detail = details[row.id];
              const credit = creditText(row.creditState, row.credits, t);
              const panelId = `link-detail-${row.id}`;
              return (
                <Fragment key={row.id}>
                  <tr className={cn("border-b last:border-b-0", open && "bg-muted/30")}>
                    <td className="px-3 py-2.5 align-top">
                      <div className="tabular-nums text-muted-foreground">{row.eventAt ? date(row.eventAt) : t.dateUnknown}</div>
                      <div className="text-xs text-muted-foreground/80">{eventLabel(row, t)}</div>
                    </td>
                    <td className="max-w-80 px-3 py-2.5 align-top">
                      <div className="truncate font-medium" title={row.counterpartDomain ?? undefined}>
                        {row.counterpartDomain ?? t.unknownWebsite}
                      </div>
                      <div className="truncate text-xs text-muted-foreground" title={row.targetUrl}>
                        {direction === "received" ? (
                          <>→ {pathOf(row.targetUrl)}</>
                        ) : (
                          <>{row.articleTitle ?? t.untitled}</>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <RankPill reading={row.authority} t={t} />
                    </td>
                    {direction === "received" ? (
                      <td className="px-3 py-2.5 align-top tabular-nums">
                        {row.value !== null && props.currency ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">{formatValue(row.value, { kind: "currency", currency: props.currency }, locale)}</span>
                        ) : (
                          <span className="text-muted-foreground" title={props.currency ? t.valueNotApplicable : t.estimateNotConfigured}>
                            <span aria-hidden="true">-</span>
                            <span className="sr-only">{props.currency ? t.valueNotApplicable : t.estimateNotConfigured}</span>
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className={cn("px-3 py-2.5 align-top text-xs", credit.className)}>{credit.text}</td>
                    {direction === "received" ? (
                      <td className="px-3 py-2.5 align-top text-xs">
                        {row.aiCitations === null ? (
                          <span className="text-muted-foreground" title={t.aiNotMeasured}>
                            <span aria-hidden="true">-</span>
                            <span className="sr-only">{t.aiNotMeasured}</span>
                          </span>
                        ) : (
                          <span title={t.aiCitationHelp}>{plural(t.aiCitations, row.aiCitations, { count: row.aiCitations })}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        <LifecycleBadge lifecycle={row.lifecycle} t={t} direction={direction} />
                        {/* Live, but not counted by search engines - the nofollow issue. */}
                        {row.nofollow ? <StatusBadge status="missing" tone="warning" label={t.nofollowBadge} animate={false} /> : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={format(open ? t.hideDetails : t.showDetails, { site: row.counterpartDomain ?? t.unknownWebsite })}
                        onClick={() => toggle(row.id)}
                      >
                        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                      </Button>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={8} id={panelId} className="px-4 py-4">
                        {loading === row.id || !detail ? (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> {t.loading}
                          </p>
                        ) : "error" in detail ? (
                          <p className="text-sm text-destructive">{detail.error}</p>
                        ) : (
                          <DetailPanel detail={detail} direction={direction} t={t} locale={locale} currency={props.currency} canEdit={props.canEdit} busy={pending} onRecheck={() => recheck(row.id)} />
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav aria-label={t.paginationLabel} className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <p className="text-muted-foreground tabular-nums">{format(t.showingRange, { first: firstShown, last: lastShown, total: props.total })}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="links-size" className="text-xs text-muted-foreground">{t.perPage}</label>
          <select
            id="links-size"
            value={props.pageSize}
            onChange={(event) => router.push(href({ size: event.target.value }))}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          {props.page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={href({ page: String(props.page - 1) }, false)} rel="prev">{t.prev}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>{t.prev}</Button>
          )}
          <span className="tabular-nums" aria-current="page">{format(t.pageOf, { page: props.page, pages: props.pageCount })}</span>
          {props.page < props.pageCount ? (
            <Button asChild size="sm" variant="outline">
              <Link href={href({ page: String(props.page + 1) }, false)} rel="next">{t.next}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>{t.next}</Button>
          )}
        </div>
      </nav>
    </div>
  );
}

function DetailPanel({
  detail,
  direction,
  t,
  locale,
  currency,
  canEdit,
  busy,
  onRecheck,
}: {
  detail: LinkDetail;
  direction: Direction;
  t: Text;
  locale: Locale;
  currency: string | null;
  canEdit: boolean;
  busy: boolean;
  onRecheck: () => void;
}) {
  const date = (d: Date | string | null) => (d ? formatDate(d, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : t.notYet);
  const source = safeHref(detail.sourceUrl);
  const destination = safeHref(detail.destinationUrl);
  const rel =
    detail.rel === null ? t.relUnknown
    : detail.rel === "" ? t.relFollowed
    : detail.nofollow ? format(t.relUnfollowed, { rel: detail.rel })
    : detail.rel;
  const lastCheck = detail.lastCheck
    ? `${date(detail.lastCheck.at)} - ${
        detail.lastCheck.outcome === "alive" ? t.checkAlive : detail.lastCheck.outcome === "missing" ? t.checkMissing : t.checkError
      }${detail.lastCheck.httpStatus ? ` (HTTP ${detail.lastCheck.httpStatus})` : ""}${detail.lastCheck.error ? ` - ${detail.lastCheck.error}` : ""}`
    : t.notYet;
  const firstVerifiedNote =
    detail.firstVerifiedSource === "first_check" ? t.fvFromCheck : detail.firstVerifiedSource === "ledger" ? t.fvFromLedger : null;
  const advice =
    detail.nofollow
      ? direction === "given" ? t.issueNofollowHostedHelp : t.issueNofollowReceivedHelp
      : detail.lifecycle === "not_found"
      ? direction === "given" ? t.adviceNotFoundGiven : t.adviceNotFoundReceived
      : detail.lifecycle === "awaiting_verification" ? t.adviceAwaitingVerification
      : detail.lifecycle === "awaiting_publication" ? (direction === "given" ? t.adviceAwaitingPublicationGiven : t.adviceAwaitingPublicationReceived)
      : detail.lifecycle === "removed" ? t.adviceRemoved
      : null;

  const rows: Array<[string, React.ReactNode]> = [
    [
      direction === "received" ? t.dSourceArticle : t.dYourArticle,
      source ? (
        <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline">
          {detail.articleTitle ?? source}
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t.opensNewTab}</span>
        </a>
      ) : (
        <span className="text-muted-foreground">{direction === "received" ? t.notPublishedYet : detail.articleTitle ?? t.notPublishedYet}</span>
      ),
    ],
    [direction === "received" ? t.dSourceSite : t.dDestinationSite, detail.counterpartDomain ?? t.unknownWebsite],
    [
      direction === "received" ? t.dYourPage : t.dDestinationPage,
      destination ? (
        <a href={destination} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline">
          {destination}
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t.opensNewTab}</span>
        </a>
      ) : (
        detail.destinationUrl
      ),
    ],
    [t.dAnchor, detail.anchor ? <q>{detail.anchor}</q> : <span className="text-muted-foreground">{t.anchorHidden}</span>],
    [t.dType, detail.managed ? t.typeManaged : t.typeExchange],
    [t.dRel, rel],
    [t.dPublished, date(detail.publishedAt)],
    [t.dFirstVerified, <>{date(detail.firstVerifiedAt)}{firstVerifiedNote ? <span className="block text-xs text-muted-foreground">{firstVerifiedNote}</span> : null}</>],
    ...(detail.removedAt ? ([[t.dRemoved, date(detail.removedAt)]] as Array<[string, React.ReactNode]>) : []),
    [t.dLastCheck, lastCheck],
    [
      t.dAuthority,
      detail.authority?.status === "ok" && detail.authority.value !== null
        ? format(t.authorityDetail, {
            value: detail.authority.value,
            max: detail.authority.scaleMax,
            date: formatDate(detail.authority.observedAt!, locale, { day: "numeric", month: "short", year: "numeric" }),
          })
        : t.authorityUnavailableDetail,
    ],
  ];
  if (direction === "received") {
    rows.push([
      t.dValue,
      detail.value !== null && currency
        ? format(t.valueDetail, { value: formatValue(detail.value, { kind: "currency", currency }, locale) })
        : currency ? t.valueNotApplicable : t.estimateNotConfigured,
    ]);
    rows.push([t.dAiCitation, detail.aiCitations === null ? t.aiNotMeasured : plural(t.aiCitationsDetail, detail.aiCitations, { count: detail.aiCitations })]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([term, value]) => (
          <Fragment key={term}>
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0">{value}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border bg-background p-3">
          <p className="font-medium">{t.dCredits}</p>
          <p className="text-xs text-muted-foreground">{creditText(detail.creditState, detail.credits, t).text}</p>
          {detail.credits_history.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {detail.credits_history.map((entry, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{formatDate(entry.at, locale, { day: "numeric", month: "short", year: "numeric" })} · {entry.note ?? entry.type}</span>
                  <span className={cn("tabular-nums", entry.amount < 0 ? "text-foreground" : "text-emerald-700 dark:text-emerald-400")}>
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t.noCreditMovements}</p>
          )}
        </div>
        {advice ? <p className="text-xs text-muted-foreground">{advice}</p> : null}
        {canEdit && detail.recheck.allowed ? (
          <Button type="button" size="sm" variant="outline" onClick={onRecheck} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {detail.lifecycle === "not_found" && direction === "given" ? t.recheckRecover : t.recheck}
          </Button>
        ) : detail.recheck.reason === "queued" ? (
          <p className="text-xs text-muted-foreground">{t.recheckAlreadyQueued}</p>
        ) : detail.recheck.reason === "cooldown" ? (
          <p className="text-xs text-muted-foreground">{t.recheckCooldown}</p>
        ) : null}
      </div>
    </div>
  );
}
