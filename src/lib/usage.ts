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

/**
 * Statuses that grant access. Stripe keeps a subscription alive through
 * payment retries as "past_due", so treating any non-"active" value as
 * cancelled would lock out customers mid-dunning; "trialing" is a paying
 * customer in waiting. Anything else (canceled, unpaid, incomplete*) does not
 * grant access.
 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Start of the org's current billing period, or the calendar month.
 *
 * Prefers the period start recorded by the webhook. The fallback derives one
 * from the period end, clamping the day to the target month's length: a naive
 * `setMonth(getMonth() - 1)` overflows FORWARD on long months — for a period
 * ending 31 Mar it yields 3 Mar (Feb has no 31st), so nearly the whole period
 * would fall outside the `createdAt >= from` window and usage would be
 * undercounted, handing out quota for free. Clamping yields 28 Feb instead.
 */
function periodStart(
  currentPeriodStart: Date | null,
  currentPeriodEnd: Date | null,
): Date {
  if (currentPeriodStart) {
    return currentPeriodStart;
  }
  if (currentPeriodEnd) {
    const start = new Date(currentPeriodEnd);
    const day = start.getDate();
    // Day 0 of month N+1 is the last day of month N — i.e. its length.
    const daysInPrevMonth = new Date(
      start.getFullYear(),
      start.getMonth(),
      0,
    ).getDate();
    // Set the day before the month so the intermediate value cannot overflow.
    start.setDate(Math.min(day, daysInPrevMonth));
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
      currentPeriodStart: subscriptions.currentPeriodStart,
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

  // A plan row alone is not entitlement: a cancelled or unpaid subscription
  // still points at the plan it used to have.
  if (!ENTITLED_STATUSES.has(sub.status)) {
    return { allowed: false, used: 0, limit: 0, reason: "subscription_inactive" };
  }

  const planLimits = {
    articles: sub.articleLimit,
    keywords: sub.keywordLimit,
    websites: sub.siteLimit,
  };
  const from = periodStart(sub.currentPeriodStart, sub.currentPeriodEnd);

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

/** Thrown when an action would exceed the organization's plan limit. */
export class LimitExceededError extends Error {
  readonly status = 402;
  constructor(
    readonly kind: LimitKind,
    readonly check: LimitCheck,
  ) {
    super(
      check.reason === "no_active_plan" ||
        check.reason === "subscription_inactive"
        ? "This workspace has no active subscription"
        : `Plan limit reached for ${kind} (${check.used}/${check.limit})`,
    );
    this.name = "LimitExceededError";
  }
}

/**
 * Enforcing counterpart to checkLimit: throws instead of reporting.
 *
 * Call this at the START of every create path for a limited resource, before
 * any external spend. checkLimit alone only reports — a caller that forgets to
 * read `allowed` silently grants unlimited usage, so paths that must enforce
 * should use this and let the error propagate.
 *
 * NOT race-proof on its own: two concurrent requests can both pass the check
 * before either inserts. That is acceptable for article/site/keyword counts
 * (worst case one extra), but anything billable per unit needs a database
 * constraint or a transaction as well.
 */
export async function requireWithinLimit(
  orgId: string,
  kind: LimitKind,
): Promise<LimitCheck> {
  const check = await checkLimit(orgId, kind);
  if (!check.allowed) {
    throw new LimitExceededError(kind, check);
  }
  return check;
}
