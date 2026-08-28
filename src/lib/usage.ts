import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  articles,
  keywords,
  plans,
  subscriptions,
  usageEvents,
  websites,
} from "@/lib/db/schema";

/**
 * Usage metering.
 *
 * Every metered external call (crawl, LLM, embedding, image, SEO API, GEO
 * query) is a per-tenant cost. If these are not recorded from the beginning,
 * unit economics break silently and there is no way to reconstruct them.
 */

export type UsageKind =
  | "crawl"
  | "llm"
  | "embedding"
  | "image"
  | "seo_api"
  | "geo_query";

/**
 * Provider unit prices in USD. Cost calculation lives here and nowhere else,
 * so a price change is a one-line edit.
 *
 * Units differ per kind:
 *  - llm / embedding: USD per 1,000 tokens
 *  - image:           USD per image
 *  - crawl:           USD per page fetched
 *  - seo_api:         USD per API call
 *  - geo_query:       USD per prompt checked per engine
 *
 * TODO: real numbers once providers are chosen (Day 5 onward). Zeroes are
 * deliberate placeholders — they make cost reporting read as "unknown" rather
 * than inventing a figure.
 */
export const PRICING = {
  llm: {
    // TODO: set once the generation model is chosen.
    "claude-sonnet-4-5": { inputPer1k: 0, outputPer1k: 0 },
  },
  embedding: {
    // TODO: set once the embedding provider is chosen (Day 12).
    "text-embedding-3-small": { per1k: 0 },
  },
  image: {
    // TODO: set once the image provider is chosen.
    default: { perImage: 0 },
  },
  crawl: {
    // Self-hosted crawling: bandwidth/compute only.
    default: { perPage: 0 },
  },
  seo_api: {
    // TODO: DataForSEO endpoint pricing varies per endpoint.
    dataforseo: { perCall: 0 },
  },
  geo_query: {
    // TODO: cost per engine differs; set per engine when wired up.
    default: { perQuery: 0 },
  },
} as const;

export type TrackInput = {
  kind: UsageKind;
  provider?: string;
  model?: string;
  quantity?: number;
  costUsd?: number;
  websiteId?: string;
  metadata?: Record<string, unknown>;
};

/** Records one metered event against an organization. */
export async function track(orgId: string, event: TrackInput): Promise<void> {
  await db.insert(usageEvents).values({
    organizationId: orgId,
    websiteId: event.websiteId ?? null,
    kind: event.kind,
    provider: event.provider ?? null,
    model: event.model ?? null,
    quantity: event.quantity ?? 1,
    costUsd: event.costUsd === undefined ? null : event.costUsd.toFixed(6),
    metadata: event.metadata ?? null,
  });
}

export type LimitKind = "articles" | "websites" | "keywords" | UsageKind;

/** Sentinel for "no limit applies". Infinity is not JSON-serialisable — it
 *  becomes null over the wire — so unlimited is represented explicitly. */
export const UNLIMITED = -1;

export type LimitCheck = {
  allowed: boolean;
  used: number;
  /** Plan limit, or UNLIMITED (-1) when the kind is metered but not capped. */
  limit: number;
  reason: string | null;
};

/** Start of the org's current billing period, or the calendar month. */
function periodStart(currentPeriodEnd: Date | null): Date {
  if (currentPeriodEnd) {
    const start = new Date(currentPeriodEnd);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Reports usage against the organization's plan limit.
 *
 * Nothing enforces limits yet — Day 3 wires this into the paths that create
 * articles, websites and keywords. The signature is fixed now so callers do
 * not need changing later.
 */
export async function checkLimit(
  orgId: string,
  kind: LimitKind,
): Promise<LimitCheck> {
  const [sub] = await db
    .select({
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      status: subscriptions.status,
      articleLimit: plans.articleLimit,
      keywordLimit: plans.keywordLimit,
      siteLimit: plans.siteLimit,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.organizationId, orgId))
    .limit(1);

  // leftJoin makes every plan column nullable; no plan row means no plan.
  if (
    !sub ||
    sub.articleLimit === null ||
    sub.keywordLimit === null ||
    sub.siteLimit === null
  ) {
    return { allowed: false, used: 0, limit: 0, reason: "no_active_plan" };
  }

  const planLimits = {
    articles: sub.articleLimit,
    keywords: sub.keywordLimit,
    websites: sub.siteLimit,
  };
  const from = periodStart(sub.currentPeriodEnd);

  let used: number;
  let limit: number;

  if (kind === "articles") {
    limit = planLimits.articles;
    const [row] = await db
      .select({ n: count() })
      .from(articles)
      .innerJoin(websites, eq(articles.websiteId, websites.id))
      .where(
        and(eq(websites.organizationId, orgId), gte(articles.createdAt, from)),
      );
    used = row?.n ?? 0;
  } else if (kind === "websites") {
    limit = planLimits.websites;
    const [row] = await db
      .select({ n: count() })
      .from(websites)
      .where(eq(websites.organizationId, orgId));
    used = row?.n ?? 0;
  } else if (kind === "keywords") {
    // Counted per organization, across all of its websites.
    limit = planLimits.keywords;
    const [row] = await db
      .select({ n: count() })
      .from(keywords)
      .innerJoin(websites, eq(keywords.websiteId, websites.id))
      .where(eq(websites.organizationId, orgId));
    used = row?.n ?? 0;
  } else {
    // Metered provider usage: counted from usage_events for the period.
    limit = UNLIMITED;
    const [row] = await db
      .select({ n: count() })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.organizationId, orgId),
          eq(usageEvents.kind, kind),
          gte(usageEvents.createdAt, from),
        ),
      );
    used = row?.n ?? 0;
  }

  const allowed = limit === UNLIMITED || used < limit;
  return {
    allowed,
    used,
    limit,
    reason: allowed ? null : "limit_reached",
  };
}
