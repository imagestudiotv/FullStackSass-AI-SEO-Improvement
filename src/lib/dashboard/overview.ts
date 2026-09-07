import { and, desc, eq, gte, inArray, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  articles,
  audits,
  gaMetrics,
  gscMetrics,
  keywords,
  placements,
  websites,
} from "@/lib/db/schema";
import { getAvailable } from "@/lib/backlinks/credits";

/**
 * Everything the dashboard shows, for one website.
 *
 * The dashboard used to list website names and nothing else, which the client
 * fairly called confusing: the platform had been working for weeks and the
 * first screen said nothing about what it had done. Each panel below answers
 * one question from the brief — what authority the site has, what is being
 * written today, what changed this week, what is performing, and what it has
 * all been worth.
 *
 * One query per panel rather than one wide join. The panels have different
 * shapes and different date windows, and a join across all of them would
 * multiply rows before aggregating — the classic way to report a number that
 * is quietly four times too big.
 */

/** Days of history the authority chart covers. */
const CHART_DAYS = 30;
/** The activity feed's window, per the brief's "7-Day Wins". */
const ACTIVITY_DAYS = 7;

export type AuthorityPoint = { date: string; backlinks: number };

export type TodaysArticle = {
  id: string;
  title: string;
  publishedUrl: string | null;
  imageUrl: string | null;
  targetKeyword: string | null;
  /** Monthly searches for the target keyword, when we know it. */
  volume: number | null;
  /** 0-100. How hard the keyword is to rank for. */
  difficulty: number | null;
  intent: string | null;
  status: string;
};

export type ActivityItem = {
  kind: "article" | "backlink" | "clicks" | "audit";
  title: string;
  detail: string;
  at: Date;
  /** Where "View" goes. Null when the item has no page of its own. */
  href: string | null;
};

export type BestArticle = {
  title: string;
  url: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type SearchPerformance = {
  clicks: number;
  impressions: number;
  position: number;
  /** Change against the previous window of the same length. */
  clicksDelta: number;
  impressionsDelta: number;
  /** Sessions attributed to AI assistants, when analytics is connected. */
  aiSessions: number;
  hasGoogle: boolean;
  hasAnalytics: boolean;
};

export type Achievements = {
  articles: number;
  backlinks: number;
  impressions: number;
  /** Visitors from articles we wrote. */
  visitors: number;
  authority: number | null;
  /** What the same traffic would have cost in Google Ads, in dollars. */
  adSpendSaved: number;
  /** What the same backlinks would have cost to buy, in dollars. */
  backlinkCostSaved: number;
  totalValue: number;
};

export type DashboardOverview = {
  websiteId: string;
  domain: string;
  brandName: string | null;
  authority: {
    verifiedBacklinks: number;
    availableCredits: number;
    chart: AuthorityPoint[];
  };
  todaysArticle: TodaysArticle | null;
  activity: ActivityItem[];
  bestArticles: BestArticle[];
  performance: SearchPerformance;
  achievements: Achievements;
};

/**
 * What a backlink and a click are worth, for the achievements panel.
 *
 * Both are deliberately conservative. The panel exists to show the work has
 * value, and a number the customer thinks is inflated does the opposite — it
 * makes every other number on the page look invented too.
 *
 * $2.50 per click is below typical Google Ads cost in most niches. $180 per
 * placement is at the low end of what agencies charge for a link.
 */
const VALUE_PER_CLICK = 2.5;
const VALUE_PER_BACKLINK = 180;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** YYYY-MM-DD, the shape gsc_metrics.date is stored in. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getDashboardOverview(
  organizationId: string,
  websiteId: string,
): Promise<DashboardOverview | null> {
  const [site] = await db
    .select({
      id: websites.id,
      domain: websites.domain,
      brandName: websites.brandName,
    })
    .from(websites)
    .where(
      and(
        eq(websites.id, websiteId),
        eq(websites.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!site) return null;

  const [
    authority,
    todaysArticle,
    activity,
    bestArticles,
    performance,
    achievements,
  ] = await Promise.all([
    loadAuthority(organizationId, site.id),
    loadTodaysArticle(site.id),
    loadActivity(site.id),
    loadBestArticles(site.id),
    loadPerformance(site.id),
    loadAchievements(site.id),
  ]);

  return {
    websiteId: site.id,
    domain: site.domain,
    brandName: site.brandName,
    authority,
    todaysArticle,
    activity,
    bestArticles,
    performance,
    achievements,
  };
}

async function loadAuthority(organizationId: string, websiteId: string) {
  /**
   * Live placements pointing AT this site — links it received. A placement
   * this site hosts for someone else is the other direction and is not the
   * customer's authority.
   */
  const rows = await db
    .select({
      createdAt: placements.createdAt,
    })
    .from(placements)
    .where(
      and(
        eq(placements.hostWebsiteId, websiteId),
        eq(placements.status, "live"),
      ),
    )
    .orderBy(placements.createdAt);

  const credits = await getAvailable(organizationId).catch(() => ({
    available: 0,
  }));

  /**
   * A running total rather than per-day counts: the chart is "how much
   * authority do I have", which only goes up, not "how many did I get on
   * Tuesday", which is noise at this scale.
   */
  const chart: AuthorityPoint[] = [];
  const start = daysAgo(CHART_DAYS);
  let running = rows.filter((r) => r.createdAt < start).length;

  for (let day = 0; day <= CHART_DAYS; day++) {
    const cursor = new Date(start);
    cursor.setUTCDate(cursor.getUTCDate() + day);
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);

    running += rows.filter(
      (r) => r.createdAt >= cursor && r.createdAt < next,
    ).length;

    chart.push({ date: isoDate(cursor), backlinks: running });
  }

  return {
    verifiedBacklinks: rows.length,
    availableCredits: credits.available,
    chart,
  };
}

async function loadTodaysArticle(
  websiteId: string,
): Promise<TodaysArticle | null> {
  /**
   * The newest article that has been written, published or not. "Today's"
   * in the brief's sense — the one the platform is working on now — rather
   * than one created in the last 24 hours, which would leave the panel empty
   * on any day nothing ran.
   */
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedUrl: articles.publishedUrl,
      imageUrl: articles.imageUrl,
      targetKeyword: articles.targetKeyword,
      status: articles.status,
    })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        inArray(articles.status, ["draft", "published"]),
      ),
    )
    .orderBy(desc(articles.updatedAt))
    .limit(1);

  if (!article) return null;

  /** Volume and difficulty live on the keyword, not the article. */
  let volume: number | null = null;
  let difficulty: number | null = null;
  let intent: string | null = null;

  if (article.targetKeyword) {
    const [keyword] = await db
      .select({
        volume: keywords.volume,
        difficulty: keywords.difficulty,
        intent: keywords.intent,
      })
      .from(keywords)
      .where(
        and(
          eq(keywords.websiteId, websiteId),
          eq(keywords.term, article.targetKeyword),
        ),
      )
      .limit(1);

    volume = keyword?.volume ?? null;
    difficulty = keyword?.difficulty ?? null;
    intent = keyword?.intent ?? null;
  }

  return { ...article, volume, difficulty, intent };
}

async function loadActivity(websiteId: string): Promise<ActivityItem[]> {
  const since = daysAgo(ACTIVITY_DAYS);
  const items: ActivityItem[] = [];

  const published = await db
    .select({
      id: articles.id,
      title: articles.title,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        eq(articles.status, "published"),
        gte(articles.updatedAt, since),
      ),
    )
    .orderBy(desc(articles.updatedAt))
    .limit(10);

  for (const article of published) {
    items.push({
      kind: "article",
      title: article.title,
      detail: "Published to your website",
      at: article.updatedAt,
      href: `/websites/${websiteId}/articles/${article.id}`,
    });
  }

  const links = await db
    .select({
      anchor: placements.anchor,
      liveUrl: placements.liveUrl,
      createdAt: placements.createdAt,
    })
    .from(placements)
    .where(
      and(
        eq(placements.hostWebsiteId, websiteId),
        eq(placements.status, "live"),
        gte(placements.createdAt, since),
      ),
    )
    .orderBy(desc(placements.createdAt))
    .limit(10);

  if (links.length > 0) {
    items.push({
      kind: "backlink",
      title: `${links.length} new ${links.length === 1 ? "backlink" : "backlinks"} verified this week`,
      detail: "Other sites linking to yours strengthens rankings",
      at: links[0].createdAt,
      href: `/websites/${websiteId}/backlinks`,
    });
  }

  /** Clicks are a weekly total, not one item per day, which would drown the feed. */
  const [clicks] = await db
    .select({
      total: raw<number>`coalesce(sum(${gscMetrics.clicks}), 0)::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, websiteId),
        gte(gscMetrics.date, isoDate(since)),
      ),
    );

  if (clicks && clicks.total > 0) {
    items.push({
      kind: "clicks",
      title: `${clicks.total} clicks from Google this week`,
      detail: "Search traffic flowing to your site",
      at: new Date(),
      href: `/websites/${websiteId}/google`,
    });
  }

  const [audit] = await db
    .select({ score: audits.score, createdAt: audits.createdAt })
    .from(audits)
    .where(
      and(eq(audits.websiteId, websiteId), gte(audits.createdAt, since)),
    )
    .orderBy(desc(audits.createdAt))
    .limit(1);

  if (audit) {
    items.push({
      kind: "audit",
      title: `Website health checked — score ${audit.score}`,
      detail: "We look for what is holding the site back on Google",
      at: audit.createdAt,
      href: `/websites/${websiteId}`,
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);
}

async function loadBestArticles(websiteId: string): Promise<BestArticle[]> {
  /**
   * Grouped by page, because Search Console reports one row per page AND
   * query — the same article appears once per search term that found it, and
   * showing those separately would list one article twenty times.
   */
  const rows = await db
    .select({
      url: gscMetrics.pageUrl,
      clicks: raw<number>`sum(${gscMetrics.clicks})::int`,
      impressions: raw<number>`sum(${gscMetrics.impressions})::int`,
      position: raw<number>`avg(${gscMetrics.position})::float`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, websiteId),
        gte(gscMetrics.date, isoDate(daysAgo(30))),
      ),
    )
    .groupBy(gscMetrics.pageUrl)
    .orderBy(raw`sum(${gscMetrics.clicks}) desc`)
    .limit(20);

  return rows
    // page_url is nullable: a site-wide row carries no page, and a table of
    // articles has nothing to show for it.
    .filter((row): row is typeof row & { url: string } => row.url !== null)
    .map((row) => ({
      // Search Console gives a URL, not a title. The last path segment read as
      // words is closer to the article's name than the raw URL.
      title: titleFromUrl(row.url),
      url: row.url,
      clicks: row.clicks,
      impressions: row.impressions,
      position: Math.round(row.position * 10) / 10,
    }));
}

function titleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    const slug = path.split("/").filter(Boolean).pop();
    if (!slug) return url;
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

async function loadPerformance(websiteId: string): Promise<SearchPerformance> {
  const now = isoDate(daysAgo(0));
  const monthAgo = isoDate(daysAgo(30));
  const twoMonthsAgo = isoDate(daysAgo(60));

  const [current] = await db
    .select({
      clicks: raw<number>`coalesce(sum(${gscMetrics.clicks}), 0)::int`,
      impressions: raw<number>`coalesce(sum(${gscMetrics.impressions}), 0)::int`,
      position: raw<number>`coalesce(avg(${gscMetrics.position}), 0)::float`,
      rows: raw<number>`count(*)::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, websiteId),
        gte(gscMetrics.date, monthAgo),
      ),
    );

  const [previous] = await db
    .select({
      clicks: raw<number>`coalesce(sum(${gscMetrics.clicks}), 0)::int`,
      impressions: raw<number>`coalesce(sum(${gscMetrics.impressions}), 0)::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, websiteId),
        gte(gscMetrics.date, twoMonthsAgo),
        raw`${gscMetrics.date} < ${monthAgo}`,
      ),
    );

  /**
   * Sessions from AI assistants. Referrals from chat products are the only
   * signal analytics gives for this, so the panel says "no AI traffic yet"
   * rather than claiming zero when nothing is connected.
   */
  const [ai] = await db
    .select({
      sessions: raw<number>`coalesce(sum(${gaMetrics.sessions}), 0)::int`,
      rows: raw<number>`count(*)::int`,
    })
    .from(gaMetrics)
    .where(
      and(eq(gaMetrics.websiteId, websiteId), gte(gaMetrics.date, monthAgo)),
    );

  void now;

  return {
    clicks: current?.clicks ?? 0,
    impressions: current?.impressions ?? 0,
    position: Math.round((current?.position ?? 0) * 10) / 10,
    clicksDelta: (current?.clicks ?? 0) - (previous?.clicks ?? 0),
    impressionsDelta: (current?.impressions ?? 0) - (previous?.impressions ?? 0),
    aiSessions: ai?.sessions ?? 0,
    hasGoogle: (current?.rows ?? 0) > 0,
    hasAnalytics: (ai?.rows ?? 0) > 0,
  };
}

async function loadAchievements(websiteId: string): Promise<Achievements> {
  const since = daysAgo(30);

  const [articleCount] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        eq(articles.status, "published"),
        gte(articles.updatedAt, since),
      ),
    );

  const [backlinkCount] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(placements)
    .where(
      and(
        eq(placements.hostWebsiteId, websiteId),
        eq(placements.status, "live"),
      ),
    );

  const [search] = await db
    .select({
      impressions: raw<number>`coalesce(sum(${gscMetrics.impressions}), 0)::int`,
      clicks: raw<number>`coalesce(sum(${gscMetrics.clicks}), 0)::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, websiteId),
        gte(gscMetrics.date, isoDate(since)),
      ),
    );

  const [audit] = await db
    .select({ score: audits.score })
    .from(audits)
    .where(eq(audits.websiteId, websiteId))
    .orderBy(desc(audits.createdAt))
    .limit(1);

  const clicks = search?.clicks ?? 0;
  const backlinks = backlinkCount?.count ?? 0;
  const adSpendSaved = Math.round(clicks * VALUE_PER_CLICK * 100) / 100;
  const backlinkCostSaved = backlinks * VALUE_PER_BACKLINK;

  return {
    articles: articleCount?.count ?? 0,
    backlinks,
    impressions: search?.impressions ?? 0,
    visitors: clicks,
    authority: audit?.score ?? null,
    adSpendSaved,
    backlinkCostSaved,
    totalValue: adSpendSaved + backlinkCostSaved,
  };
}
