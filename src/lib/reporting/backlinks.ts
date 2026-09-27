import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { AUTHORITY_METRIC, normalizeDomain, readAuthority, type AuthorityReading } from "@/lib/authority/metric";
import { getAvailable } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { activePolicy, backlinkValue, backlinkValueSql, type ValuationPolicy } from "@/lib/valuation/policy";

/**
 * A Date as a SQL parameter in a RAW template. postgres-js (production) does
 * not serialize Date objects there - only drizzle's typed operators do - so
 * raw templates pass UTC ISO text. For a `timestamp` column Postgres ignores
 * the zone designator, which is exactly the UTC wall-clock these columns hold.
 */
const utc = (date: Date) => date.toISOString();


/**
 * THE backlink reporting layer. Every card, chart, table and banner that
 * counts network links reads it, so a number means the same thing wherever
 * it appears. Callers authorize (the website belongs to the viewer) before
 * calling; everything here is scoped to one website and one workspace.
 *
 * DIRECTION
 *   received - links TO this website: placements whose REQUEST belongs to it
 *              (backlink_requests.website_id). Earlier code counted
 *              placements.host_website_id = site, which is the opposite
 *              direction - links this site hosts for others.
 *   given    - links this website HOSTS for others (placements.host_website_id).
 *
 * LIFECYCLE (placements.status -> what the customer is told)
 *   pending, drafted -> awaiting_publication   (placed; the partner's article is not live)
 *   published        -> awaiting_verification  (live article; link not seen yet)
 *   live             -> verified               (seen on the live page; credits settled)
 *   unverified       -> not_found              (checked repeatedly, never found; never charged)
 *   removed          -> removed                (was verified, then confirmed gone; refunded)
 *   cancelled        -> withdrawn              (taken out before publication; reservation released)
 *   anything else    -> unknown                (never shown as verified or refunded)
 *
 * DATES come from recorded events, never from updated_at:
 *   first verified = placements.live_at, else the first "alive" link check,
 *                    else the settlement ledger entry (older rows predate
 *                    live_at); unknown when none exists - never guessed.
 *   published      = placements.published_at, else the article's first
 *                    successful publish log.
 *   removed        = placements.removed_at, else the refund ledger entry.
 * All dates are UTC; report days are UTC calendar days.
 *
 * REFUNDED means a refund ledger entry exists for the placement - not a
 * withdrawn draft, whose reservation was released and nothing was charged.
 *
 * Provider-discovered external backlinks are NOT part of this: these are
 * RepGet-managed placements only, so nothing overlaps or double-counts.
 */

export type Direction = "received" | "given";
export type Lifecycle =
  | "awaiting_publication"
  | "awaiting_verification"
  | "verified"
  | "not_found"
  | "removed"
  | "withdrawn"
  | "unknown";
export type CreditState = "reserved" | "settled" | "refunded" | "earned" | "reversed" | "pending" | "none";
export type EventKind = "verified" | "removed" | "published" | "placed" | "unknown";

/* ------------------------------------------------------------------------ */
/* Windows                                                                  */
/* ------------------------------------------------------------------------ */

export const RANGES = ["7d", "30d", "90d", "365d"] as const;
export type Range = (typeof RANGES)[number];

export type ReportWindow = {
  range: Range;
  /** First UTC day in the window (inclusive). */
  from: Date;
  /** The day after the last one (exclusive). */
  to: Date;
  days: number;
};

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The last N complete-or-current UTC days, ending today (inclusive). */
export function resolveWindow(range: string | null | undefined, now: Date = new Date()): ReportWindow {
  const r = (RANGES as readonly string[]).includes(range ?? "") ? (range as Range) : "30d";
  const days = Number.parseInt(r, 10);
  const to = new Date(utcDay(now).getTime() + 86_400_000);
  const from = new Date(to.getTime() - days * 86_400_000);
  return { range: r, from, to, days };
}

/** The window of equal length immediately before. */
export function previousWindow(window: ReportWindow): ReportWindow {
  return { ...window, to: window.from, from: new Date(window.from.getTime() - window.days * 86_400_000) };
}

/* ------------------------------------------------------------------------ */
/* Placement facts                                                          */
/* ------------------------------------------------------------------------ */

/**
 * Timestamps leave raw SQL as explicit UTC ISO text (see OUT): the columns
 * hold UTC wall-clock time without a zone, and letting a driver parse them
 * would read them in the server's local zone.
 */
const ts = (value: unknown): Date | null => (value === null || value === undefined ? null : new Date(value as string));
const iso = (column: string) => `to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** The listed columns of `f`, with every timestamp as UTC ISO text. */
const OUT = sql.raw(`
  f.id, f.status, f.managed, f.credits, f.live_url, f.anchor, f.article_id, f.target_url, f.request_status,
  f.host_domain, f.beneficiary_domain, f.counterpart_domain, f.article_title, f.lifecycle,
  f.first_verified_source, f.authority_value, f.ai_citations,
  ${iso("f.created_at")} as created_at,
  ${iso("f.last_verified_at")} as last_verified_at,
  ${iso("f.recheck_requested_at")} as recheck_requested_at,
  ${iso("f.published_at")} as published_at,
  ${iso("f.first_verified_at")} as first_verified_at,
  ${iso("f.removed_at")} as removed_at,
  ${iso("f.charged_at")} as charged_at,
  ${iso("f.earned_at")} as earned_at,
  ${iso("f.refunded_at")} as refunded_at,
  ${iso("f.reversed_at")} as reversed_at
`);

/**
 * One row per placement in the given direction, with every derived fact.
 * `websiteId` is the subject website; `orgId` its owning workspace (the only
 * workspace whose ledger rows are ever joined in).
 */
function facts(direction: Direction, websiteId: string, orgId: string): SQL {
  const scope = direction === "received" ? sql`r.website_id = ${websiteId}` : sql`p.host_website_id = ${websiteId}`;
  // The website on the OTHER side of the link.
  const counterpart = direction === "received" ? sql`h` : sql`b`;
  return sql`
    select
      p.id,
      p.status,
      p.managed,
      p.credits,
      p.created_at,
      p.live_url,
      p.anchor,
      p.article_id,
      p.last_verified_at,
      p.recheck_requested_at,
      r.target_url,
      r.status as request_status,
      h.domain as host_domain,
      b.domain as beneficiary_domain,
      ${counterpart}.domain as counterpart_domain,
      a.title as article_title,
      case p.status
        when 'pending' then 'awaiting_publication'
        when 'drafted' then 'awaiting_publication'
        when 'published' then 'awaiting_verification'
        when 'live' then 'verified'
        when 'unverified' then 'not_found'
        when 'removed' then 'removed'
        when 'cancelled' then 'withdrawn'
        else 'unknown'
      end as lifecycle,
      case when p.status in ('published', 'live', 'removed', 'unverified') then
        coalesce(p.published_at, (
          select min(pl.created_at) from publish_logs pl
          where pl.article_id = p.article_id and pl.status = 'published'
        ))
      end as published_at,
      case when p.status in ('live', 'removed') then
        coalesce(p.live_at, first_alive.at, charge.at)
      end as first_verified_at,
      case when p.status in ('live', 'removed') then
        case
          when p.live_at is not null then 'recorded'
          when first_alive.at is not null then 'first_check'
          when charge.at is not null then 'ledger'
        end
      end as first_verified_source,
      case when p.status = 'removed' then coalesce(p.removed_at, refund.at) end as removed_at,
      charge.at as charged_at,
      earned.at as earned_at,
      refund.at as refunded_at,
      reversal.at as reversed_at,
      dm.value as authority_value,
      dm.observed_at as authority_observed_at,
      ai.citations as ai_citations
    from placements p
    join backlink_requests r on r.id = p.request_id
    join websites b on b.id = r.website_id
    left join websites h on h.id = p.host_website_id
    left join articles a on a.id = p.article_id
    left join lateral (
      select min(lc.checked_at) as at from link_checks lc
      where lc.placement_id = p.id and (lc.outcome = 'alive' or (lc.outcome is null and lc.alive))
    ) first_alive on true
    left join lateral (
      select min(cl.created_at) as at from credit_ledger cl
      where cl.reference_id = p.id::text and cl.type = 'link_received'
        ${direction === "received" ? sql`and cl.organization_id = ${orgId}` : sql``}
    ) charge on true
    left join lateral (
      select min(cl.created_at) as at from credit_ledger cl
      where cl.reference_id = p.id::text and cl.type = 'link_given'
        and ${direction === "given" ? sql`cl.organization_id = ${orgId}` : sql`false`}
    ) earned on true
    left join lateral (
      select min(cl.created_at) as at from credit_ledger cl
      where cl.reference_id = p.id::text and cl.type = 'refund'
        and ${direction === "received" ? sql`cl.organization_id = ${orgId}` : sql`true`}
    ) refund on true
    left join lateral (
      select min(cl.created_at) as at from credit_ledger cl
      where cl.idempotency_key = 'placement:' || p.id::text || ':host_reversal'
        and ${direction === "given" ? sql`cl.organization_id = ${orgId}` : sql`false`}
    ) reversal on true
    left join lateral (
      -- AI answers (this website's AI Visibility checks) that CITED the page
      -- carrying the link. Measured data only; see LinkRow.aiCitations.
      select count(*)::int as citations from geo_results gr
      where gr.website_id = ${websiteId} and gr.cited and p.live_url is not null
        and gr.checked_at > timezone('utc', now()) - interval '90 days'
        and regexp_replace(regexp_replace(lower(split_part(gr.source_url, '?', 1)), '^https?://(www\\.)?', ''), '/+$', '')
          = regexp_replace(regexp_replace(lower(split_part(p.live_url, '?', 1)), '^https?://(www\\.)?', ''), '/+$', '')
    ) ai on true
    left join domain_metrics dm
      on dm.domain = regexp_replace(lower(${counterpart}.domain), '^www\\.', '')
     and dm.provider = ${AUTHORITY_METRIC.provider}
     and dm.metric = ${AUTHORITY_METRIC.metric}
     and dm.value is not null
    where ${scope}
  `;
}

/** The date a row is listed under, and what it means, per lifecycle. */
const EVENT_AT = sql`(case f.lifecycle
  when 'verified' then f.first_verified_at
  when 'removed' then f.removed_at
  when 'awaiting_verification' then f.published_at
  when 'not_found' then f.published_at
  when 'awaiting_publication' then f.created_at
  when 'withdrawn' then f.created_at
end)`;

/**
 * Whether the counterpart's article is published. Before that, its title
 * and the link's words are another workspace's unpublished draft - not shown,
 * and not searchable.
 */
const PUBLISHED = sql`(f.lifecycle in ('awaiting_verification', 'verified', 'not_found', 'removed'))`;

/* ------------------------------------------------------------------------ */
/* Listing                                                                  */
/* ------------------------------------------------------------------------ */

export const TABS = ["all", "verified", "pending", "refunded"] as const;
export type Tab = (typeof TABS)[number];
export const TYPES = ["all", "managed", "exchange"] as const;
export type LinkType = (typeof TYPES)[number];
export const SORTS = ["date", "source", "authority", "value", "credits", "status"] as const;
export type SortKey = (typeof SORTS)[number];
export const ISSUES = ["not_found"] as const;
export type Issue = (typeof ISSUES)[number];

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;

export type ListQuery = {
  tab: Tab;
  type: LinkType;
  q: string;
  /** Inclusive UTC day, on the listed date (EVENT_AT). */
  from: Date | null;
  /** Inclusive UTC day. */
  to: Date | null;
  issue: Issue | null;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dayParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** URL search params -> a validated query. Anything unknown falls back to defaults. */
export function parseListQuery(params: Record<string, string | string[] | undefined>): ListQuery {
  const tab = first(params.tab);
  const type = first(params.type);
  const sort = first(params.sort);
  const dir = first(params.dir);
  const issue = first(params.issue);
  const size = Number.parseInt(first(params.size) ?? "", 10);
  const page = Number.parseInt(first(params.page) ?? "", 10);
  return {
    tab: (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "all",
    type: (TYPES as readonly string[]).includes(type ?? "") ? (type as LinkType) : "all",
    q: (first(params.q) ?? "").trim().slice(0, 100),
    from: dayParam(first(params.from)),
    to: dayParam(first(params.to)),
    issue: (ISSUES as readonly string[]).includes(issue ?? "") ? (issue as Issue) : null,
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : "date",
    dir: dir === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

function filters(direction: Direction, query: Omit<ListQuery, "tab" | "sort" | "dir" | "page" | "pageSize">): SQL {
  const parts: SQL[] = [sql`true`];
  if (query.type === "managed") parts.push(sql`f.managed`);
  if (query.type === "exchange") parts.push(sql`not f.managed`);
  if (query.issue === "not_found") parts.push(sql`f.lifecycle = 'not_found'`);
  if (query.from) parts.push(sql`${EVENT_AT} >= ${utc(query.from)}`);
  if (query.to) parts.push(sql`${EVENT_AT} < ${utc(new Date(query.to.getTime() + 86_400_000))}`);
  if (query.q) {
    const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // The partner's anchor and article are searchable only once published.
    const anchorVisible = direction === "given" ? sql`true` : PUBLISHED;
    parts.push(sql`(
      f.counterpart_domain ilike ${like}
      or f.target_url ilike ${like}
      or (${anchorVisible} and (f.anchor ilike ${like} or f.article_title ilike ${like}))
    )`);
  }
  return sql.join(parts, sql` and `);
}

function tabFilter(tab: Tab): SQL {
  switch (tab) {
    case "verified":
      return sql`f.lifecycle = 'verified'`;
    case "pending":
      return sql`f.lifecycle in ('awaiting_publication', 'awaiting_verification')`;
    case "refunded":
      return sql`f.refunded_at is not null`;
    default:
      return sql`true`;
  }
}

const STATUS_ORDER = sql`(case f.lifecycle
  when 'verified' then 1 when 'awaiting_verification' then 2 when 'awaiting_publication' then 3
  when 'not_found' then 4 when 'removed' then 5 when 'withdrawn' then 6 else 7 end)`;

export type LinkRow = {
  id: string;
  lifecycle: Lifecycle;
  /** The listed date and what it records. */
  eventAt: Date | null;
  eventKind: EventKind;
  managed: boolean;
  /** The other website: the source for received links, the destination for given ones. */
  counterpartDomain: string | null;
  /** Path on the destination page (the customer's page for received links). */
  targetUrl: string;
  /** Hidden (null) until the counterpart's article is published. */
  anchor: string | null;
  articleTitle: string | null;
  liveUrl: string | null;
  credits: number;
  creditState: CreditState;
  authority: AuthorityReading | null;
  /** Estimated equivalent value; null when not configured or not valued. */
  value: number | null;
  /**
   * How many of this website's AI Visibility answers (last 90 days) cited
   * the page carrying the link. Null when NOT MEASURED: the website ran no
   * AI checks in that period, or the page is not published. Never inferred
   * from authority or verification.
   */
  aiCitations: number | null;
};

export type LinkPage = {
  rows: LinkRow[];
  /** Matching the filters AND the tab. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Per tab, matching the other filters - for the tab badges. */
  tabCounts: Record<Tab, number>;
  policy: ValuationPolicy | null;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Record<string, unknown>[];
}

function creditState(direction: Direction, row: Record<string, unknown>): CreditState {
  const lifecycle = row.lifecycle as Lifecycle;
  if (direction === "received") {
    if (row.refunded_at) return "refunded";
    if (row.charged_at) return "settled";
    if ((lifecycle === "awaiting_publication" || lifecycle === "awaiting_verification") && ["pending", "matched"].includes(row.request_status as string)) {
      return "reserved";
    }
    return "none";
  }
  if (row.reversed_at) return "reversed";
  if (row.earned_at) return "earned";
  if (lifecycle === "awaiting_publication" || lifecycle === "awaiting_verification") return "pending";
  return "none";
}

function eventKind(lifecycle: Lifecycle): EventKind {
  switch (lifecycle) {
    case "verified":
      return "verified";
    case "removed":
      return "removed";
    case "awaiting_verification":
    case "not_found":
      return "published";
    case "awaiting_publication":
    case "withdrawn":
      return "placed";
    default:
      return "unknown";
  }
}

/**
 * One page of links, server-side filtered, sorted (with the placement id as
 * the stable tie-breaker) and paginated. The tab counts come from a separate
 * aggregate over the same filters, never from the loaded page.
 */
export async function listLinks(
  direction: Direction,
  subject: { websiteId: string; orgId: string },
  query: ListQuery,
): Promise<LinkPage> {
  const policy = await activePolicy();
  const base = facts(direction, subject.websiteId, subject.orgId);
  const where = filters(direction, query);
  const valueSql = backlinkValueSql(policy, sql`f.authority_value`);
  const valued = sql`(case when f.lifecycle = 'verified' then ${valueSql} end)`;

  const sortExpr: SQL =
    query.sort === "source" ? sql`lower(f.counterpart_domain)`
    : query.sort === "authority" ? sql`f.authority_value`
    : query.sort === "value" ? valued
    : query.sort === "credits" ? sql`f.credits`
    : query.sort === "status" ? STATUS_ORDER
    : EVENT_AT;
  const direction_ = query.dir === "asc" ? sql`asc` : sql`desc`;

  const [countsResult] = await Promise.all([
    db.execute(sql`
      with f as (${base})
      select
        count(*)::int as all,
        count(*) filter (where ${tabFilter("verified")})::int as verified,
        count(*) filter (where ${tabFilter("pending")})::int as pending,
        count(*) filter (where ${tabFilter("refunded")})::int as refunded
      from f where ${where}
    `),
  ]);
  const counts = rowsOf(countsResult)[0] ?? {};
  const tabCounts: Record<Tab, number> = {
    all: Number(counts.all ?? 0),
    verified: Number(counts.verified ?? 0),
    pending: Number(counts.pending ?? 0),
    refunded: Number(counts.refunded ?? 0),
  };
  const total = tabCounts[query.tab];
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);

  const result = await db.execute(sql`
    with f as (${base})
    select ${OUT}, to_char(${EVENT_AT}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as event_at
    from f
    where ${where} and ${tabFilter(query.tab)}
    order by ${sortExpr} ${direction_} nulls last, f.id ${direction_}
    limit ${query.pageSize} offset ${(page - 1) * query.pageSize}
  `);
  const raw = rowsOf(result);
  const [authority, measured] = await Promise.all([
    readAuthority(raw.map((r) => r.counterpart_domain as string | null)),
    aiChecksRun(subject.websiteId),
  ]);

  const rows: LinkRow[] = raw.map((row) => {
    const lifecycle = row.lifecycle as Lifecycle;
    const published = ["awaiting_verification", "verified", "not_found", "removed"].includes(lifecycle);
    const visible = direction === "given" || published;
    const key = normalizeDomain(row.counterpart_domain as string | null);
    const reading = key ? authority.get(key) ?? null : null;
    return {
      id: row.id as string,
      lifecycle,
      eventAt: ts(row.event_at),
      eventKind: eventKind(lifecycle),
      managed: Boolean(row.managed),
      counterpartDomain: (row.counterpart_domain as string | null) ?? null,
      targetUrl: row.target_url as string,
      anchor: visible ? ((row.anchor as string | null) ?? null) : null,
      articleTitle: visible ? ((row.article_title as string | null) ?? null) : null,
      liveUrl: published ? ((row.live_url as string | null) ?? null) : null,
      credits: Number(row.credits ?? 0),
      creditState: creditState(direction, row),
      authority: reading,
      value:
        direction === "received" && lifecycle === "verified"
          ? backlinkValue(policy, reading?.status === "ok" ? reading.value : null)
          : null,
      aiCitations: measured && published ? Number(row.ai_citations ?? 0) : null,
    };
  });

  return { rows, total, page, pageSize: query.pageSize, pageCount, tabCounts, policy };
}

/** Whether this website ran any AI Visibility check in the last 90 days. */
async function aiChecksRun(websiteId: string): Promise<boolean> {
  const result = await db.execute(sql`
    select exists (
      select 1 from geo_results where website_id = ${websiteId}
        and checked_at > timezone('utc', now()) - interval '90 days'
    ) as run
  `);
  return Boolean(rowsOf(result)[0]?.run);
}

/* ------------------------------------------------------------------------ */
/* One link, in detail                                                      */
/* ------------------------------------------------------------------------ */

export type LinkDetail = LinkRow & {
  sourceUrl: string | null;
  destinationUrl: string;
  publishedAt: Date | null;
  firstVerifiedAt: Date | null;
  firstVerifiedSource: "recorded" | "first_check" | "ledger" | null;
  removedAt: Date | null;
  lastCheck: { at: Date; outcome: "alive" | "missing" | "error" | null; httpStatus: number | null; error: string | null } | null;
  /** The rel the live page had on the last successful check; null = unknown. */
  rel: string | null;
  /** This workspace's ledger entries for the link - never the other side's. */
  credits_history: Array<{ at: Date; type: string; amount: number; note: string | null }>;
  recheck: { allowed: boolean; reason: string | null; requestedAt: Date | null };
};

export async function linkDetail(
  direction: Direction,
  subject: { websiteId: string; orgId: string },
  placementId: string,
): Promise<LinkDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(placementId)) return null;
  const policy = await activePolicy();
  const result = await db.execute(sql`
    with f as (${facts(direction, subject.websiteId, subject.orgId)})
    select ${OUT}, to_char(${EVENT_AT}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as event_at from f where f.id = ${placementId}
  `);
  const row = rowsOf(result)[0];
  if (!row) return null;

  const [checkResult, ledgerResult] = await Promise.all([
    db.execute(sql`
      select to_char(checked_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as checked_at, outcome, alive, http_status, error,
        (select rel from link_checks x where x.placement_id = ${placementId} and x.outcome = 'alive' order by x.checked_at desc limit 1) as last_rel
      from link_checks where placement_id = ${placementId} order by checked_at desc limit 1
    `),
    db.execute(sql`
      select to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at, type, amount, note from credit_ledger
      where organization_id = ${subject.orgId}
        and (reference_id = ${placementId} or idempotency_key like ${`placement:${placementId}:%`})
      order by created_at asc
      limit 20
    `),
  ]);
  const check = rowsOf(checkResult)[0];
  const lifecycle = row.lifecycle as Lifecycle;
  const published = ["awaiting_verification", "verified", "not_found", "removed"].includes(lifecycle);
  const visible = direction === "given" || published;
  const authority = row.counterpart_domain ? (await readAuthority([row.counterpart_domain as string])).values().next().value ?? null : null;
  const recheck = recheckPolicy(direction, lifecycle, ts(row.recheck_requested_at), ts(row.last_verified_at));
  const measured = await aiChecksRun(subject.websiteId);

  return {
    id: row.id as string,
    lifecycle,
    eventAt: ts(row.event_at),
    eventKind: eventKind(lifecycle),
    managed: Boolean(row.managed),
    counterpartDomain: (row.counterpart_domain as string | null) ?? null,
    targetUrl: row.target_url as string,
    destinationUrl: row.target_url as string,
    anchor: visible ? ((row.anchor as string | null) ?? null) : null,
    articleTitle: visible ? ((row.article_title as string | null) ?? null) : null,
    liveUrl: published ? ((row.live_url as string | null) ?? null) : null,
    sourceUrl: published ? ((row.live_url as string | null) ?? null) : null,
    credits: Number(row.credits ?? 0),
    creditState: creditState(direction, row),
    authority,
    value:
      direction === "received" && lifecycle === "verified"
        ? backlinkValue(policy, authority?.status === "ok" ? authority.value : null)
        : null,
    aiCitations: measured && published ? Number(row.ai_citations ?? 0) : null,
    publishedAt: ts(row.published_at),
    firstVerifiedAt: ts(row.first_verified_at),
    firstVerifiedSource: (row.first_verified_source as LinkDetail["firstVerifiedSource"]) ?? null,
    removedAt: ts(row.removed_at),
    lastCheck: check
      ? {
          at: ts(check.checked_at)!,
          outcome: ((check.outcome as string | null) ?? (check.alive ? "alive" : "missing")) as "alive" | "missing" | "error",
          httpStatus: (check.http_status as number | null) ?? null,
          error: (check.error as string | null) ?? null,
        }
      : null,
    rel: check ? ((check.last_rel as string | null) ?? null) : null,
    credits_history: rowsOf(ledgerResult).map((l) => ({
      at: ts(l.created_at)!,
      type: l.type as string,
      amount: Number(l.amount),
      note: (l.note as string | null) ?? null,
    })),
    recheck,
  };
}

/* ------------------------------------------------------------------------ */
/* Recheck policy (shared with lib/reporting/recheck.ts)                    */
/* ------------------------------------------------------------------------ */

/** A placement may be re-checked at most once in this long. */
export const RECHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function recheckPolicy(
  direction: Direction,
  lifecycle: Lifecycle,
  requestedAt: Date | null,
  lastVerifiedAt: Date | null,
  now: Date = new Date(),
): { allowed: boolean; reason: string | null; requestedAt: Date | null } {
  const checkable = lifecycle === "awaiting_verification" || lifecycle === "not_found" || (lifecycle === "verified" && direction === "given");
  if (!checkable) return { allowed: false, reason: "not_checkable", requestedAt };
  if (requestedAt && (!lastVerifiedAt || requestedAt > lastVerifiedAt)) {
    return { allowed: false, reason: "queued", requestedAt };
  }
  if (requestedAt && now.getTime() - requestedAt.getTime() < RECHECK_COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown", requestedAt };
  }
  return { allowed: true, reason: null, requestedAt };
}

/* ------------------------------------------------------------------------ */
/* Metrics                                                                  */
/* ------------------------------------------------------------------------ */

export type WorkspaceCredits = {
  /** Every figure belongs to the WORKSPACE, shared by all its websites. */
  scope: "workspace";
  balance: number;
  reserved: number;
  available: number;
  /** Charged for verified links received (all time). */
  spent: number;
  /** Earned for verified links hosted (all time, net of reversals). */
  earned: number;
  /** Returned because a verified link was later confirmed removed. */
  refunded: number;
};

export async function workspaceCredits(orgId: string): Promise<WorkspaceCredits> {
  const [available, sums] = await Promise.all([
    getAvailable(orgId),
    db.execute(sql`
      select
        coalesce(-sum(amount) filter (where type = 'link_received'), 0)::int as spent,
        coalesce(sum(amount) filter (where type = 'link_given'), 0)::int
          + coalesce(sum(amount) filter (where idempotency_key like 'placement:%:host_reversal'), 0)::int as earned,
        coalesce(sum(amount) filter (where type = 'refund' and reference_id in (select id::text from placements)), 0)::int as refunded
      from credit_ledger where organization_id = ${orgId}
    `),
  ]);
  const row = rowsOf(sums)[0] ?? {};
  return {
    scope: "workspace",
    ...available,
    spent: Number(row.spent ?? 0),
    earned: Number(row.earned ?? 0),
    refunded: Number(row.refunded ?? 0),
  };
}

export type BacklinkMetrics = {
  window: ReportWindow;
  received: {
    /** Currently verified links to this website. */
    verified: number;
    /** Distinct websites among those verified links. */
    referringDomains: number;
    /** Links first verified inside the window (a link verified, then removed, still counts). */
    firstVerifiedInWindow: number;
    firstVerifiedPrevious: number;
    awaitingPublication: number;
    awaitingVerification: number;
    notFound: number;
    removed: number;
    refunded: number;
    /** Verified links whose first-verification date is unknown (old rows). */
    undated: number;
  };
  given: {
    verified: number;
    awaitingPublication: number;
    awaitingVerification: number;
    /** Links not found on this website's published articles: no credits earned. */
    notFound: number;
    /** Distinct articles with such a link. */
    notFoundArticles: number;
  };
  /** Newest verified received links, by first verification. */
  latest: LinkRow[];
  strongest: AuthorityReading | null;
  /** Estimated equivalent value of the verified received links; null when not configured. */
  portfolioValue: number | null;
  /** Verified received links the policy could not value (e.g. unknown authority, no band). */
  unvaluedLinks: number;
  policy: ValuationPolicy | null;
  own: AuthorityReading | null;
};

export async function backlinkMetrics(
  subject: { websiteId: string; orgId: string; domain: string },
  window: ReportWindow,
): Promise<BacklinkMetrics> {
  const previous = previousWindow(window);
  const [receivedResult, givenResult, latestPage, policy] = await Promise.all([
    db.execute(sql`
      with f as (${facts("received", subject.websiteId, subject.orgId)})
      select
        count(*) filter (where lifecycle = 'verified')::int as verified,
        count(distinct lower(counterpart_domain)) filter (where lifecycle = 'verified')::int as referring_domains,
        count(*) filter (where first_verified_at >= ${utc(window.from)} and first_verified_at < ${utc(window.to)})::int as first_in_window,
        count(*) filter (where first_verified_at >= ${utc(previous.from)} and first_verified_at < ${utc(previous.to)})::int as first_previous,
        count(*) filter (where lifecycle = 'awaiting_publication')::int as awaiting_publication,
        count(*) filter (where lifecycle = 'awaiting_verification')::int as awaiting_verification,
        count(*) filter (where lifecycle = 'not_found')::int as not_found,
        count(*) filter (where lifecycle = 'removed')::int as removed,
        count(*) filter (where refunded_at is not null)::int as refunded,
        count(*) filter (where lifecycle in ('verified', 'removed') and first_verified_at is null)::int as undated,
        array_agg(distinct counterpart_domain) filter (where lifecycle = 'verified') as verified_domains,
        array_agg(authority_value) filter (where lifecycle = 'verified') as verified_ranks
      from f
    `),
    db.execute(sql`
      with f as (${facts("given", subject.websiteId, subject.orgId)})
      select
        count(*) filter (where lifecycle = 'verified')::int as verified,
        count(*) filter (where lifecycle = 'awaiting_publication')::int as awaiting_publication,
        count(*) filter (where lifecycle = 'awaiting_verification')::int as awaiting_verification,
        count(*) filter (where lifecycle = 'not_found')::int as not_found,
        count(distinct article_id) filter (where lifecycle = 'not_found')::int as not_found_articles
      from f
    `),
    listLinks("received", subject, {
      tab: "verified", type: "all", q: "", from: null, to: null, issue: null, sort: "date", dir: "desc", page: 1, pageSize: 3,
    }),
    activePolicy(),
  ]);
  const r = rowsOf(receivedResult)[0] ?? {};
  const g = rowsOf(givenResult)[0] ?? {};
  const domains = ((r.verified_domains as string[] | null) ?? []).filter(Boolean);
  const readings = await readAuthority([...domains, subject.domain]);
  const own = readings.get(normalizeDomain(subject.domain) ?? "") ?? null;
  const verifiedReadings = domains
    .map((d) => readings.get(normalizeDomain(d) ?? ""))
    .filter((x): x is AuthorityReading => Boolean(x));
  const strongest =
    verifiedReadings.filter((x) => x.status === "ok" && x.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? null;

  // Value: per verified link, by its source's rank (one row per link, not per domain).
  let portfolioValue: number | null = null;
  let unvaluedLinks = 0;
  if (policy && policy.backlinkRates.length > 0) {
    portfolioValue = 0;
    for (const rank of (r.verified_ranks as Array<number | null> | null) ?? []) {
      const value = backlinkValue(policy, rank ?? null);
      if (value === null) unvaluedLinks++;
      else portfolioValue += value;
    }
  }

  return {
    window,
    received: {
      verified: Number(r.verified ?? 0),
      referringDomains: Number(r.referring_domains ?? 0),
      firstVerifiedInWindow: Number(r.first_in_window ?? 0),
      firstVerifiedPrevious: Number(r.first_previous ?? 0),
      awaitingPublication: Number(r.awaiting_publication ?? 0),
      awaitingVerification: Number(r.awaiting_verification ?? 0),
      notFound: Number(r.not_found ?? 0),
      removed: Number(r.removed ?? 0),
      refunded: Number(r.refunded ?? 0),
      undated: Number(r.undated ?? 0),
    },
    given: {
      verified: Number(g.verified ?? 0),
      awaitingPublication: Number(g.awaiting_publication ?? 0),
      awaitingVerification: Number(g.awaiting_verification ?? 0),
      notFound: Number(g.not_found ?? 0),
      notFoundArticles: Number(g.not_found_articles ?? 0),
    },
    latest: latestPage.rows,
    strongest,
    portfolioValue,
    unvaluedLinks,
    policy,
    own,
  };
}

/* ------------------------------------------------------------------------ */
/* History                                                                  */
/* ------------------------------------------------------------------------ */

export type HistoryPoint = {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  /** Links verified live at the END of the day (can fall when links are removed). */
  active: number;
  /** Links ever first verified up to the end of the day (never falls). */
  cumulative: number;
  /** Links first verified on the day. */
  firstVerified: number;
};

export type History = {
  window: ReportWindow;
  points: HistoryPoint[];
  /**
   * Verified links with no recorded verification date (rows older than the
   * event columns). They are NOT placed on the chart; the chart says so.
   */
  undated: number;
};

/** Received-link history per UTC day, from recorded events only. */
export async function receivedHistory(subject: { websiteId: string; orgId: string }, window: ReportWindow): Promise<History> {
  const result = await db.execute(sql`
    with f as (${facts("received", subject.websiteId, subject.orgId)}),
    dated as (select first_verified_at, removed_at from f where lifecycle in ('verified', 'removed') and first_verified_at is not null),
    days as (select generate_series(${utc(window.from)}::timestamp, ${utc(window.to)}::timestamp - interval '1 day', interval '1 day') as day)
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      count(x.first_verified_at) filter (where x.first_verified_at < d.day + interval '1 day'
        and (x.removed_at is null or x.removed_at >= d.day + interval '1 day'))::int as active,
      count(x.first_verified_at) filter (where x.first_verified_at < d.day + interval '1 day')::int as cumulative,
      count(x.first_verified_at) filter (where x.first_verified_at >= d.day and x.first_verified_at < d.day + interval '1 day')::int as first_verified
    from days d left join dated x on true
    group by d.day order by d.day
  `);
  const undatedResult = await db.execute(sql`
    with f as (${facts("received", subject.websiteId, subject.orgId)})
    select count(*)::int as n from f where lifecycle in ('verified', 'removed') and first_verified_at is null
  `);
  return {
    window,
    points: rowsOf(result).map((p) => ({
      day: p.day as string,
      active: Number(p.active),
      cumulative: Number(p.cumulative),
      firstVerified: Number(p.first_verified),
    })),
    undated: Number(rowsOf(undatedResult)[0]?.n ?? 0),
  };
}

/* ------------------------------------------------------------------------ */
/* Issues                                                                   */
/* ------------------------------------------------------------------------ */

export type Issues = {
  /** Distinct articles of THIS website where a partner's link was not found - no credits earned. */
  hostedArticlesMissingLink: number;
  /** Received links never found on the partner's published article - never charged. */
  receivedNotFound: number;
  /**
   * Changes whenever the set of issues changes, so a dismissed banner comes
   * back for new issues. Contains no ids.
   */
  fingerprint: string;
};

export async function backlinkIssues(subject: { websiteId: string; orgId: string }): Promise<Issues> {
  const [given, received] = await Promise.all([
    db.execute(sql`
      with f as (${facts("given", subject.websiteId, subject.orgId)})
      select count(distinct article_id)::int as n, extract(epoch from max(published_at))::bigint as latest, count(*)::int as links
      from f where lifecycle = 'not_found'
    `),
    db.execute(sql`
      with f as (${facts("received", subject.websiteId, subject.orgId)})
      select count(*)::int as n, extract(epoch from max(published_at))::bigint as latest from f where lifecycle = 'not_found'
    `),
  ]);
  const g = rowsOf(given)[0] ?? {};
  const r = rowsOf(received)[0] ?? {};
  const fingerprint = [g.links ?? 0, g.latest ?? 0, r.n ?? 0, r.latest ?? 0].join(".");
  return {
    hostedArticlesMissingLink: Number(g.n ?? 0),
    receivedNotFound: Number(r.n ?? 0),
    fingerprint,
  };
}

/* ------------------------------------------------------------------------ */
/* Credit activity                                                          */
/* ------------------------------------------------------------------------ */

export type CreditActivityRow = {
  id: string;
  at: Date;
  type: string;
  amount: number;
  note: string | null;
  /** The workspace website a placement entry concerns; null for workspace-wide entries. */
  websiteDomain: string | null;
};

/**
 * The WORKSPACE's credit ledger, newest first, paginated in the database.
 * Zero rows (period-settled markers) are left out, as everywhere else.
 */
export async function creditActivity(
  orgId: string,
  options: { page: number; pageSize: number },
): Promise<{ rows: CreditActivityRow[]; total: number; page: number; pageCount: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(options.pageSize, 10), MAX_PAGE_SIZE);
  const countResult = await db.execute(sql`
    select count(*)::int as n from credit_ledger where organization_id = ${orgId} and amount <> 0
  `);
  const total = Number(rowsOf(countResult)[0]?.n ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(options.page, 1), pageCount);
  const result = await db.execute(sql`
    select cl.id, to_char(cl.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at, cl.type, cl.amount, cl.note,
      (select case
         when cl.type in ('link_given') or cl.idempotency_key like 'placement:%:host_reversal' then h.domain
         else b.domain end
       from placements p
       join backlink_requests r on r.id = p.request_id
       join websites b on b.id = r.website_id
       left join websites h on h.id = p.host_website_id
       where p.id::text = cl.reference_id
         and (b.organization_id = ${orgId} or h.organization_id = ${orgId})
       limit 1) as website_domain
    from credit_ledger cl
    where cl.organization_id = ${orgId} and cl.amount <> 0
    order by cl.created_at desc, cl.id desc
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);
  return {
    rows: rowsOf(result).map((row) => ({
      id: row.id as string,
      at: new Date(row.at as string),
      type: row.type as string,
      amount: Number(row.amount),
      note: (row.note as string | null) ?? null,
      websiteDomain: (row.website_domain as string | null) ?? null,
    })),
    total,
    page,
    pageCount,
    pageSize,
  };
}
