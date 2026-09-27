import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { readOneAuthority, type AuthorityReading } from "@/lib/authority/metric";
import { db } from "@/lib/db";
import { articles, audits, calendarItems, keywords, websites } from "@/lib/db/schema";
import {
  backlinkMetrics,
  previousWindow,
  receivedHistory,
  resolveWindow,
  workspaceCredits,
  type BacklinkMetrics,
  type History,
  type ReportWindow,
  type WorkspaceCredits,
} from "@/lib/reporting/backlinks";
import { activePolicy, backlinkValue, clickValuation, type ValuationPolicy } from "@/lib/valuation/policy";

/**
 * A Date as a SQL parameter in a RAW template. postgres-js (production) does
 * not serialize Date objects there - only drizzle's typed operators do - so
 * raw templates pass UTC ISO text. For a `timestamp` column Postgres ignores
 * the zone designator, which is exactly the UTC wall-clock these columns hold.
 */
const utc = (date: Date) => date.toISOString();


/**
 * Everything the dashboard shows, for one website - built on the shared
 * reporting layer (lib/reporting/backlinks.ts), so the backlink figures here
 * are the same numbers the Backlinks pages show.
 *
 * WINDOWS. One selected range (7, 30, 90 or 365 UTC days ending today)
 * drives the headline, the metric cards, the chart and the details table -
 * never a mix. Comparisons are against the window of equal length before.
 * "7-day wins" is always the last 7 UTC days. Search Console reports two to
 * three days late, so its freshness (latest day received) is reported beside
 * its figures rather than hidden.
 *
 * WHAT IS COUNTED
 *   articles published - articles that first went LIVE in the window
 *                        (articles.first_live_at: the first delivery the CMS
 *                        stored as published). A WordPress draft is not a
 *                        publication - it counts on the day it goes live;
 *                        editing and republishing is not a new publication.
 *                        Articles live before this was recorded, whose date
 *                        cannot be established from their history, are
 *                        counted as "date unknown", never given a date.
 *   backlinks          - received network links first verified in the window.
 *   article clicks and impressions - Search Console, for the pages RepGet
 *                        published for the site only (page-scoped), not the
 *                        whole site. Site-wide totals are labelled site-wide.
 *                        Pages are matched by lib/reporting/page-key.ts (query
 *                        strings and path case are kept), each page counted
 *                        once however many article rows point at it, and
 *                        totals cover EVERY page - the details list is
 *                        limited, the totals are not.
 *   article sessions   - Google Analytics sessions on those pages; a
 *                        separate measure, never added to Search Console clicks.
 *   authority          - DataForSEO Rank (lib/authority/metric.ts); the
 *                        website-health audit score is a separate figure.
 *   estimated value    - only under a published valuation policy
 *                        (lib/valuation/policy.ts); otherwise "not configured".
 *
 * Failures are not zeros: a section that cannot be loaded says so.
 */

/**
 * A page's identity for joins: repget_page_key (migration 0045), the SQL twin
 * of lib/reporting/page-key.ts. A host-less path (Google Analytics) resolves
 * against the website's own domain.
 */
const pageKeySql = (column: ReturnType<typeof sql>, domain: string) => sql`repget_page_key(${column}, ${domain})`;

/**
 * The website's article pages, ONE row per page: two article rows pointing
 * at the same page (a re-created post, a trailing-slash variant) would
 * otherwise each claim its traffic. The page belongs to the article that
 * went live first.
 */
function articlePages(websiteId: string, domain: string) {
  return sql`(
    select distinct on (keyed.page_key) keyed.*
    from (
      select ${pageKeySql(sql`a.published_url`, domain)} as page_key,
        a.id, a.title, a.published_url as url, a.target_keyword as keyword, a.first_live_at, a.created_at,
        k.cpc::float as cpc
      from articles a
      left join keywords k on k.website_id = a.website_id and k.term = a.target_keyword
      where a.website_id = ${websiteId} and a.published_url is not null
    ) keyed
    order by keyed.page_key, keyed.first_live_at asc nulls last, keyed.created_at asc, keyed.id
  )`;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Record<string, unknown>[];
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** A section that could not be loaded, instead of a fake zero. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

async function load<T>(label: string, fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    console.error(`[dashboard] ${label} failed`, error);
    return { ok: false, error: label };
  }
}

/* ------------------------------------------------------------------------ */

export type TodaysArticle = {
  id: string;
  title: string;
  imageUrl: string | null;
  publishedUrl: string | null;
  targetKeyword: string | null;
  volume: number | null;
  difficulty: number | null;
  intent: string | null;
  plannedFor: Date | null;
  /**
   * published | awaiting_review (held for the RepGet team) | approved (approved,
   * waiting for its day or the customer) | scheduled (goes out on its day) |
   * draft (waits for the customer) | writing.
   */
  state: "published" | "awaiting_review" | "approved" | "scheduled" | "draft" | "writing" | "failed";
};

export type Win =
  | { kind: "published"; title: string; at: Date; href: string }
  | { kind: "links_received"; count: number; at: Date; href: string }
  | { kind: "links_given"; count: number; at: Date; href: string }
  | { kind: "audit"; score: number; at: Date; href: string }
  | { kind: "clicks"; clicks: number; through: string; href: string };

export type BestArticle = {
  articleId: string;
  title: string;
  url: string;
  clicks: number;
  impressions: number;
  position: number | null;
};

export type SeriesPoint = { day: string; value: number | null };
export type MetricKey = "value" | "articles" | "backlinks" | "impressions" | "clicks" | "sessions";

export type Achievements = {
  window: ReportWindow;
  policy: ValuationPolicy | null;
  articlesPublished: number;
  backlinksReceived: number;
  /** Search Console, article pages only. Null when Search Console is not connected. */
  impressions: number | null;
  clicks: number | null;
  /** Google Analytics sessions on article pages. Null when Analytics is not connected. */
  sessions: number | null;
  /** Estimated equivalent values (policy currency); null = not configured / not valued. */
  trafficValue: number | null;
  trafficValueReason: string | null;
  backlinkValue: number | null;
  totalValue: number | null;
  authority: AuthorityReading | null;
  healthScore: number | null;
  searchConsoleThrough: string | null;
  analyticsThrough: string | null;
  /**
   * Articles live on the site whose first live date cannot be established
   * (published before RepGet recorded it, with an ambiguous history). Not
   * counted in any window; shown as a note.
   */
  unknownPublicationDates: number;
  series: Record<MetricKey, SeriesPoint[]>;
  /** Pages in total; `breakdown` lists at most BREAKDOWN_LIMIT of them. The totals above cover all. */
  breakdownTotal: number;
  breakdown: Array<{
    articleId: string;
    title: string;
    url: string;
    firstPublished: Date | null;
    clicks: number;
    impressions: number;
    sessions: number | null;
    keyword: string | null;
    cpc: number | null;
    value: number | null;
  }>;
};

export type SearchPerformance = {
  google: {
    connected: boolean;
    through: string | null;
    clicks: number;
    impressions: number;
    position: number | null;
    /** Null when the previous window is incomplete - no misleading change is shown. */
    clicksChange: number | null;
    impressionsChange: number | null;
  };
  ai: {
    /** AI-visibility checks run for this website in the window. */
    checks: number;
    mentioned: number;
    cited: number;
    lastCheckedAt: Date | null;
  };
};

export type DashboardOverview = {
  websiteId: string;
  domain: string;
  brandName: string | null;
  window: ReportWindow;
  /** Credits belong to the workspace; hidden (null) for an invited guest. */
  credits: WorkspaceCredits | null;
  backlinks: Loaded<BacklinkMetrics>;
  history: Loaded<History>;
  todaysArticle: Loaded<TodaysArticle | null>;
  wins: Loaded<{ from: Date; to: Date; items: Win[] }>;
  bestArticles: Loaded<{ through: string | null; connected: boolean; rows: BestArticle[] }>;
  achievements: Loaded<Achievements>;
  search: Loaded<SearchPerformance>;
};

export async function getDashboardOverview(
  input: { websiteId: string; ownerOrgId: string; showCredits: boolean; range?: string | null },
): Promise<DashboardOverview | null> {
  const [site] = await db
    .select({ id: websites.id, domain: websites.domain, brandName: websites.brandName })
    .from(websites)
    .where(and(eq(websites.id, input.websiteId), eq(websites.organizationId, input.ownerOrgId)))
    .limit(1);
  if (!site) return null;

  const window = resolveWindow(input.range);
  const subject = { websiteId: site.id, orgId: input.ownerOrgId, domain: site.domain };
  const [credits, backlinks, history, todaysArticle, wins, bestArticles, achievements, search] = await Promise.all([
    input.showCredits ? workspaceCredits(input.ownerOrgId).catch(() => null) : Promise.resolve(null),
    load("backlinks", () => backlinkMetrics(subject, window)),
    load("history", () => receivedHistory(subject, window)),
    load("todays_article", () => loadTodaysArticle(site.id)),
    load("wins", () => loadWins(subject)),
    load("best_articles", () => loadBestArticles(site.id, site.domain)),
    load("achievements", () => loadAchievements(subject, window)),
    load("search", () => loadSearch(site.id, window)),
  ]);
  return { websiteId: site.id, domain: site.domain, brandName: site.brandName, window, credits, backlinks, history, todaysArticle, wins, bestArticles, achievements, search };
}

/* ------------------------------------------------------------------------ */

async function loadTodaysArticle(websiteId: string): Promise<TodaysArticle | null> {
  /*
    The article planned for today (UTC); otherwise the next one planned;
    otherwise the newest written. Not "the most recently edited" - an edit
    does not make an article today's.
  */
  const today = isoDay(new Date());
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      imageUrl: articles.imageUrl,
      publishedUrl: articles.publishedUrl,
      targetKeyword: articles.targetKeyword,
      status: articles.status,
      reviewStatus: articles.reviewStatus,
      plannedFor: calendarItems.scheduledFor,
      autoPublish: websites.autoPublish,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(and(eq(articles.websiteId, websiteId), inArray(articles.status, ["draft", "published", "generating", "queued", "failed"])))
    .orderBy(
      sql`(${calendarItems.scheduledFor}::date = ${today}::date) desc nulls last`,
      sql`(${calendarItems.scheduledFor}::date > ${today}::date) desc nulls last`,
      sql`${calendarItems.scheduledFor} asc nulls last`,
      desc(articles.createdAt),
    )
    .limit(1);
  if (!article) return null;

  let volume: number | null = null;
  let difficulty: number | null = null;
  let intent: string | null = null;
  if (article.targetKeyword) {
    const [keyword] = await db
      .select({ volume: keywords.volume, difficulty: keywords.difficulty, intent: keywords.intent })
      .from(keywords)
      .where(and(eq(keywords.websiteId, websiteId), eq(keywords.term, article.targetKeyword)))
      .limit(1);
    volume = keyword?.volume ?? null;
    difficulty = keyword?.difficulty ?? null;
    intent = keyword?.intent ?? null;
  }

  const state: TodaysArticle["state"] =
    article.status === "published" ? "published"
    : article.status === "generating" || article.status === "queued" ? "writing"
    : article.status === "failed" ? "failed"
    : article.reviewStatus === "pending" ? "awaiting_review"
    : article.reviewStatus === "approved" ? "approved"
    : article.autoPublish ? "scheduled"
    : "draft";
  return {
    id: article.id,
    title: article.title,
    imageUrl: article.imageUrl,
    publishedUrl: article.publishedUrl,
    targetKeyword: article.targetKeyword,
    volume,
    difficulty,
    intent,
    plannedFor: article.plannedFor,
    state,
  };
}

/** How many pages the details list shows; totals always cover every page. */
export const BREAKDOWN_LIMIT = 200;

async function loadWins(subject: { websiteId: string; orgId: string; domain: string }): Promise<{ from: Date; to: Date; items: Win[] }> {
  const week = resolveWindow("7d");
  const base = `/websites/${subject.websiteId}`;
  const [published, metrics, given, audit, clicks] = await Promise.all([
    db.execute(sql`
      select a.id, a.title, to_char(a.first_live_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
      from articles a
      where a.website_id = ${subject.websiteId}
        and a.first_live_at >= ${utc(week.from)} and a.first_live_at < ${utc(week.to)}
      order by a.first_live_at desc limit 5
    `),
    backlinkMetrics(subject, week),
    db.execute(sql`
      select count(*)::int as n, to_char(max(cl.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
      from credit_ledger cl
      join placements p on p.id::text = cl.reference_id
      where cl.type = 'link_given' and cl.organization_id = ${subject.orgId}
        and p.host_website_id = ${subject.websiteId}
        and cl.created_at >= ${utc(week.from)} and cl.created_at < ${utc(week.to)}
    `),
    db
      .select({ score: audits.score, createdAt: audits.createdAt })
      .from(audits)
      .where(and(eq(audits.websiteId, subject.websiteId), sql`${audits.createdAt} >= ${utc(week.from)}`, sql`${audits.score} is not null`))
      .orderBy(desc(audits.createdAt))
      .limit(1),
    db.execute(sql`
      select coalesce(sum(gsc_clicks), 0)::int as clicks, max(date)::text as through, count(gsc_clicks)::int as days
      from site_daily_metrics
      where website_id = ${subject.websiteId} and date >= ${isoDay(week.from)}::date and date < ${isoDay(week.to)}::date
    `),
  ]);

  const items: Win[] = [];
  for (const row of rowsOf(published)) {
    items.push({ kind: "published", title: row.title as string, at: new Date(row.at as string), href: `${base}/articles/${row.id}` });
  }
  if (metrics.received.firstVerifiedInWindow > 0) {
    const newest = metrics.latest.find((l) => l.eventAt)?.eventAt ?? week.to;
    items.push({ kind: "links_received", count: metrics.received.firstVerifiedInWindow, at: newest, href: `${base}/backlinks/links?tab=verified&sort=date` });
  }
  const g = rowsOf(given)[0];
  if (g && Number(g.n) > 0) {
    items.push({ kind: "links_given", count: Number(g.n), at: new Date(g.at as string), href: `${base}/backlinks/hosted?tab=verified` });
  }
  if (audit[0] && audit[0].score !== null) {
    items.push({ kind: "audit", score: audit[0].score, at: audit[0].createdAt, href: base });
  }
  const c = rowsOf(clicks)[0];
  if (c && Number(c.days) > 0 && Number(c.clicks) > 0) {
    items.push({ kind: "clicks", clicks: Number(c.clicks), through: c.through as string, href: `${base}/google` });
  }
  items.sort((a, b) => ("at" in b ? b.at.getTime() : 0) - ("at" in a ? a.at.getTime() : 0));
  return { from: week.from, to: week.to, items };
}

async function loadBestArticles(websiteId: string, domain: string): Promise<{ through: string | null; connected: boolean; rows: BestArticle[] }> {
  // The last 30 days Search Console has reported, for pages RepGet published here.
  const [latest] = rowsOf(await db.execute(sql`select max(date)::text as through from gsc_page_metrics where website_id = ${websiteId}`));
  const through = (latest?.through as string | null) ?? null;
  if (!through) return { through: null, connected: false, rows: [] };
  const result = await db.execute(sql`
    with pages as ${articlePages(websiteId, domain)}
    select p.id, p.title, p.url,
      coalesce(sum(g.clicks), 0)::int as clicks,
      coalesce(sum(g.impressions), 0)::int as impressions,
      sum(g.position * g.impressions) / nullif(sum(g.impressions), 0) as position
    from pages p
    join gsc_page_metrics g
      on g.website_id = ${websiteId}
     and ${pageKeySql(sql`g.page_url`, domain)} = p.page_key
     and g.date > (${through}::date - 30) and g.date <= ${through}::date
    group by p.id, p.title, p.url
    order by clicks desc, impressions desc, p.id
    limit 5
  `);
  return {
    through,
    connected: true,
    rows: rowsOf(result).map((r) => ({
      articleId: r.id as string,
      title: r.title as string,
      url: r.url as string,
      clicks: Number(r.clicks),
      impressions: Number(r.impressions),
      position: r.position === null ? null : Math.round(Number(r.position) * 10) / 10,
    })),
  };
}

async function loadAchievements(subject: { websiteId: string; orgId: string; domain: string }, window: ReportWindow): Promise<Achievements> {
  const policy = await activePolicy();
  const valuation = clickValuation(policy);
  const fromDay = isoDay(window.from);
  const toDay = isoDay(window.to);

  const site = subject.websiteId;
  const pages = articlePages(site, subject.domain);
  // Traffic per page for the window, keyed like the pages.
  const gscByPage = sql`(
    select ${pageKeySql(sql`g.page_url`, subject.domain)} as page_key,
      sum(g.clicks)::int as clicks, sum(g.impressions)::int as impressions
    from gsc_page_metrics g
    where g.website_id = ${site} and g.date >= ${fromDay}::date and g.date < ${toDay}::date
    group by 1
  )`;
  const gaByPage = sql`(
    select ${pageKeySql(sql`m.page_url`, subject.domain)} as page_key, sum(m.sessions)::int as sessions
    from ga_metrics m
    where m.website_id = ${site} and m.date >= ${fromDay}::date and m.date < ${toDay}::date
    group by 1
  )`;

  const [perArticle, daily, publication, freshness, backlinks, history, authority, health] = await Promise.all([
    /*
      The details list (top BREAKDOWN_LIMIT pages) and the TOTALS over every
      page, in one pass: window aggregates are computed before the limit.
    */
    db.execute(sql`
      with pages as ${pages},
      per_page as (
        select p.*, coalesce(gsc.clicks, 0) as clicks, coalesce(gsc.impressions, 0) as impressions, ga.sessions
        from pages p
        left join ${gscByPage} gsc on gsc.page_key = p.page_key
        left join ${gaByPage} ga on ga.page_key = p.page_key
      )
      select pp.id, pp.title, pp.url, pp.keyword, pp.cpc, pp.clicks, pp.impressions, pp.sessions,
        to_char(pp.first_live_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as first_published,
        count(*) over ()::int as total_pages,
        sum(pp.clicks) over ()::int as total_clicks,
        sum(pp.impressions) over ()::int as total_impressions,
        sum(coalesce(pp.sessions, 0)) over ()::int as total_sessions,
        sum(pp.clicks * coalesce(pp.cpc, 0)) over ()::float as total_cpc_value
      from per_page pp
      order by pp.clicks desc, pp.id
      limit ${BREAKDOWN_LIMIT}
    `),
    // The chart, per day, over the same pages the totals use.
    db.execute(sql`
      with pages as ${pages},
      days as (select generate_series(${fromDay}::date, ${toDay}::date - 1, interval '1 day')::date as day),
      gsc_daily as (
        select g.date as day, sum(g.clicks)::int as clicks, sum(g.impressions)::int as impressions,
          sum(g.clicks * coalesce(p.cpc, 0))::float as cpc_value
        from gsc_page_metrics g join pages p on p.page_key = ${pageKeySql(sql`g.page_url`, subject.domain)}
        where g.website_id = ${site} and g.date >= ${fromDay}::date and g.date < ${toDay}::date
        group by g.date
      ),
      ga_daily as (
        select m.date as day, sum(m.sessions)::int as sessions
        from ga_metrics m join pages p on p.page_key = ${pageKeySql(sql`m.page_url`, subject.domain)}
        where m.website_id = ${site} and m.date >= ${fromDay}::date and m.date < ${toDay}::date
        group by m.date
      ),
      live as (
        select (a.first_live_at)::date as day, count(*)::int as n
        from articles a
        where a.website_id = ${site} and a.first_live_at >= ${fromDay}::date and a.first_live_at < ${toDay}::date
        group by 1
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
        coalesce(live.n, 0) as articles,
        coalesce(gd.clicks, 0) as clicks,
        coalesce(gd.impressions, 0) as impressions,
        gd.cpc_value,
        ga.sessions
      from days d
      left join live on live.day = d.day
      left join gsc_daily gd on gd.day = d.day
      left join ga_daily ga on ga.day = d.day
      order by d.day
    `),
    db.execute(sql`
      select count(*)::int as unknown from articles
      where website_id = ${site} and status = 'published' and first_live_at is null
    `),
    db.execute(sql`
      select (select max(date)::text from gsc_page_metrics where website_id = ${subject.websiteId}) as gsc,
             (select max(date)::text from ga_metrics where website_id = ${subject.websiteId}) as ga
    `),
    backlinkMetrics(subject, window),
    receivedHistory(subject, window),
    readOneAuthority(subject.domain),
    db.select({ score: audits.score }).from(audits).where(and(eq(audits.websiteId, subject.websiteId), sql`${audits.score} is not null`)).orderBy(desc(audits.createdAt)).limit(1),
  ]);

  const fresh = rowsOf(freshness)[0] ?? {};
  const gscThrough = (fresh.gsc as string | null) ?? null;
  const gaThrough = (fresh.ga as string | null) ?? null;
  const pageRows = rowsOf(perArticle);
  const days = rowsOf(daily);
  const totals = pageRows[0] ?? {};
  const totalPages = Number(totals.total_pages ?? 0);

  const clickValueOf = (clicks: number, cpc: number | null): number | null => {
    if (!valuation.usable || !policy) return null;
    if (valuation.mode === "fixed") return clicks * (policy.fixedClickRate ?? 0);
    return cpc === null ? null : clicks * cpc;
  };

  const breakdown = pageRows.map((p) => {
    const clicks = Number(p.clicks);
    const cpc = p.cpc === null ? null : Number(p.cpc);
    return {
      articleId: p.id as string,
      title: p.title as string,
      url: p.url as string,
      firstPublished: p.first_published ? new Date(p.first_published as string) : null,
      clicks,
      impressions: Number(p.impressions),
      sessions: p.sessions === null ? null : Number(p.sessions),
      keyword: (p.keyword as string | null) ?? null,
      cpc,
      value: gscThrough ? clickValueOf(clicks, cpc) : null,
    };
  });

  // Totals over EVERY page, not the listed ones.
  const clicks = gscThrough ? Number(totals.total_clicks ?? 0) : null;
  const impressions = gscThrough ? Number(totals.total_impressions ?? 0) : null;
  const sessions = gaThrough ? Number(totals.total_sessions ?? 0) : null;
  const trafficValue =
    gscThrough && valuation.usable && policy
      ? valuation.mode === "fixed"
        ? Number(totals.total_clicks ?? 0) * (policy.fixedClickRate ?? 0)
        : Number(totals.total_cpc_value ?? 0)
      : null;
  const trafficValueReason = !valuation.usable ? valuation.reason : !gscThrough ? "search_console_not_connected" : null;

  // Backlink value of links first verified in the window and still verified.
  let linkValue: number | null = null;
  if (policy && policy.backlinkRates.length > 0) {
    linkValue = 0;
    const recent = await db.execute(sql`
      select dm.value as rank
      from placements p
      join backlink_requests r on r.id = p.request_id
      left join websites h on h.id = p.host_website_id
      left join domain_metrics dm on dm.domain = regexp_replace(lower(h.domain), '^www\\.', '')
        and dm.provider = 'dataforseo' and dm.metric = 'backlinks_rank' and dm.value is not null
      where r.website_id = ${subject.websiteId} and p.status = 'live'
        and coalesce(p.live_at, (select min(lc.checked_at) from link_checks lc where lc.placement_id = p.id and (lc.outcome = 'alive' or (lc.outcome is null and lc.alive)))) >= ${utc(window.from)}
        and coalesce(p.live_at, (select min(lc.checked_at) from link_checks lc where lc.placement_id = p.id and (lc.outcome = 'alive' or (lc.outcome is null and lc.alive)))) < ${utc(window.to)}
    `);
    for (const row of rowsOf(recent)) linkValue += backlinkValue(policy, row.rank === null ? null : Number(row.rank)) ?? 0;
  }
  const totalValue = trafficValue !== null || linkValue !== null ? (trafficValue ?? 0) + (linkValue ?? 0) : null;

  // Daily series for the chart - each in its own unit; the chart shows one at a time.
  const valuePerDay = (day: Record<string, unknown>): number | null => {
    if (!valuation.usable || !policy || !gscThrough) return null;
    if (String(day.day) > gscThrough) return null;
    return valuation.mode === "fixed" ? Number(day.clicks) * (policy.fixedClickRate ?? 0) : Number(day.cpc_value ?? 0);
  };
  const gscDay = (day: Record<string, unknown>, key: string): number | null =>
    gscThrough && String(day.day) <= gscThrough ? Number(day[key]) : null;
  const gaDay = (day: Record<string, unknown>): number | null =>
    gaThrough && String(day.day) <= gaThrough ? Number(day.sessions ?? 0) : null;

  return {
    window,
    policy,
    articlesPublished: days.reduce((s, d) => s + Number(d.articles), 0),
    backlinksReceived: backlinks.received.firstVerifiedInWindow,
    impressions,
    clicks,
    sessions,
    trafficValue,
    trafficValueReason,
    backlinkValue: linkValue,
    totalValue,
    authority,
    healthScore: health[0]?.score ?? null,
    searchConsoleThrough: gscThrough,
    analyticsThrough: gaThrough,
    unknownPublicationDates: Number(rowsOf(publication)[0]?.unknown ?? 0),
    series: {
      value: days.map((d) => ({ day: String(d.day), value: valuePerDay(d) })),
      articles: days.map((d) => ({ day: String(d.day), value: Number(d.articles) })),
      backlinks: history.points.map((p) => ({ day: p.day, value: p.active })),
      impressions: days.map((d) => ({ day: String(d.day), value: gscDay(d, "impressions") })),
      clicks: days.map((d) => ({ day: String(d.day), value: gscDay(d, "clicks") })),
      sessions: days.map((d) => ({ day: String(d.day), value: gaDay(d) })),
    },
    breakdownTotal: totalPages,
    breakdown,
  };
}

async function loadSearch(websiteId: string, window: ReportWindow): Promise<SearchPerformance> {
  const previous = previousWindow(window);
  const windowSql = (w: ReportWindow) => sql`
    select coalesce(sum(gsc_clicks), 0)::int as clicks,
      coalesce(sum(gsc_impressions), 0)::int as impressions,
      sum(gsc_position * gsc_impressions) / nullif(sum(gsc_impressions), 0) as position,
      count(gsc_clicks)::int as days,
      max(date) filter (where gsc_clicks is not null)::text as through
    from site_daily_metrics
    where website_id = ${websiteId} and date >= ${isoDay(w.from)}::date and date < ${isoDay(w.to)}::date
  `;
  const [current, before, ai] = await Promise.all([
    db.execute(windowSql(window)),
    db.execute(windowSql(previous)),
    db.execute(sql`
      select count(*)::int as checks,
        count(*) filter (where mentioned)::int as mentioned,
        count(*) filter (where cited)::int as cited,
        to_char(max(checked_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as last
      from geo_results where website_id = ${websiteId} and checked_at >= ${utc(window.from)} and checked_at < ${utc(window.to)}
    `),
  ]);
  const c = rowsOf(current)[0] ?? {};
  const p = rowsOf(before)[0] ?? {};
  const a = rowsOf(ai)[0] ?? {};
  // A change only against a previous window Search Console fully reported.
  const comparable = Number(p.days ?? 0) >= window.days - 3;
  return {
    google: {
      connected: Number(c.days ?? 0) > 0,
      through: (c.through as string | null) ?? null,
      clicks: Number(c.clicks ?? 0),
      impressions: Number(c.impressions ?? 0),
      position: c.position === null || c.position === undefined ? null : Math.round(Number(c.position) * 10) / 10,
      clicksChange: comparable ? Number(c.clicks ?? 0) - Number(p.clicks ?? 0) : null,
      impressionsChange: comparable ? Number(c.impressions ?? 0) - Number(p.impressions ?? 0) : null,
    },
    ai: {
      checks: Number(a.checks ?? 0),
      mentioned: Number(a.mentioned ?? 0),
      cited: Number(a.cited ?? 0),
      lastCheckedAt: a.last ? new Date(a.last as string) : null,
    },
  };
}
