import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { UNLIMITED, type LimitCheck } from "@/lib/usage-shared";
import { agencyLimits } from "@/lib/agency/core";
import {
  articles,
  keywords,
  plans,
  starterTrials,
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
 * These are LIST prices and will drift. They exist so cost per tenant is
 * recorded from the first metered call; re-check them against the providers'
 * pricing pages before quoting margins to anyone.
 */
export const PRICING = {
  llm: {
    /**
     * Article generation. Sonnet 5 is the default: at roughly 12k input and
     * 6k output tokens per article it costs about $0.08, under 3% of even the
     * entry plan's revenue, so quality is worth more here than saving cents.
     * Haiku handles cheap structured extraction (brand, industry, language)
     * during onboarding. Opus is listed for jobs that justify it.
     */
    "claude-sonnet-5": { inputPer1k: 0.002, outputPer1k: 0.01 },
    "claude-haiku-4-5": { inputPer1k: 0.001, outputPer1k: 0.005 },
    "claude-opus-5": { inputPer1k: 0.005, outputPer1k: 0.025 },
  },
  embedding: {
    // OpenAI text-embedding-3-small: $0.02 per 1M tokens.
    "text-embedding-3-small": { per1k: 0.00002 },
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
    /**
     * DataForSEO, priced per endpoint rather than per call, so these are the
     * three shapes we actually use.
     *
     * rankTrackingPerKeyword is charged EVERY time a keyword is checked, which
     * makes check frequency — not plan size — the real cost driver: 1,500
     * keywords daily is ~$27/mo (8% of Scale's revenue), the same keywords
     * weekly is ~$3.60 (1%). Track weekly and cache; rankings do not move
     * enough day to day to justify 7x the spend.
     */
    dataforseo: { perCall: 0.002 },
    dataforseoKeywordsPer1kRows: { perCall: 0.02 },
    dataforseoRankTrackingPerKeyword: { perCall: 0.0006 },
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

// Defined in usage-shared.ts so client components can import them without
// pulling in the database driver; re-exported here for server callers.
export { UNLIMITED } from "@/lib/usage-shared";
export type { LimitCheck } from "@/lib/usage-shared";

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
/**
 * Keywords a Starter trial may research.
 *
 * Enough to choose what the one article should be about. The trial is meant to
 * demonstrate the product, and research is cheap next to the article itself.
 */
export const STARTER_TRIAL_KEYWORDS = 25;

/** The org's unspent Starter trial, or null when it has none. */
async function starterTrialLimits(
  orgId: string,
): Promise<{ articleGrant: number; articlesUsed: number } | null> {
  const [row] = await db
    .select({
      articleGrant: starterTrials.articleGrant,
      articlesUsed: starterTrials.articlesUsed,
    })
    .from(starterTrials)
    .where(eq(starterTrials.organizationId, orgId))
    .limit(1);

  return row ?? null;
}

/**
 * Marks one article of the Starter trial as used.
 *
 * A stored counter rather than counting article rows: a trial article that is
 * later deleted must not hand back the grant, or the offer becomes unlimited
 * for anyone willing to delete as they go.
 */
export async function consumeStarterTrialArticle(
  orgId: string,
): Promise<boolean> {
  const updated = await db
    .update(starterTrials)
    .set({ articlesUsed: sql`${starterTrials.articlesUsed} + 1` })
    // The WHERE is the guard: two concurrent requests cannot both pass it, so
    // the grant cannot be spent twice.
    .where(
      and(
        eq(starterTrials.organizationId, orgId),
        lt(starterTrials.articlesUsed, starterTrials.articleGrant),
      ),
    )
    .returning({ id: starterTrials.id });

  return updated.length > 0;
}

export async function checkLimit(
  orgId: string,
  kind: LimitKind,
): Promise<LimitCheck> {
  /**
   * Agency workspaces are ours, not sold, so they have no subscription and
   * would otherwise fail the entitlement check below. Their limits come from
   * their own row — real numbers rather than unlimited, so an internal
   * workspace still cannot run away with cost.
   *
   * Checked first because the two branches are mutually exclusive: an agency
   * workspace never has a plan to fall back to.
   */
  const agency = await agencyLimits(orgId);

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

  const entitledBySubscription =
    Boolean(sub) &&
    sub.articleLimit !== null &&
    sub.keywordLimit !== null &&
    sub.siteLimit !== null &&
    ENTITLED_STATUSES.has(sub.status);

  /**
   * The Starter trial: a one-off purchase with no subscription behind it.
   *
   * Checked only when nothing else entitles this workspace, so someone who
   * later subscribes is governed by their plan rather than by a spent trial.
   * Without this branch a trial buyer is told they have no active plan — for
   * the article they have just paid for.
   */
  if (!agency && !entitledBySubscription) {
    const trial = await starterTrialLimits(orgId);
    if (trial) {
      if (kind === "articles") {
        return {
          allowed: trial.articlesUsed < trial.articleGrant,
          used: trial.articlesUsed,
          limit: trial.articleGrant,
          reason:
            trial.articlesUsed < trial.articleGrant ? null : "limit_reached",
        };
      }
      /**
       * The trial covers one website and the keywords needed to write for it.
       * Keywords are research rather than spend — capping them below what one
       * article needs would block the article itself.
       */
      if (kind === "websites") {
        const [row] = await db
          .select({ n: count() })
          .from(websites)
          .where(eq(websites.organizationId, orgId));
        const used = row?.n ?? 0;
        return {
          allowed: used < 1,
          used,
          limit: 1,
          reason: used < 1 ? null : "limit_reached",
        };
      }
      if (kind === "keywords") {
        // Keywords belong to a website, not directly to the org.
        const [row] = await db
          .select({ n: count() })
          .from(keywords)
          .innerJoin(websites, eq(keywords.websiteId, websites.id))
          .where(eq(websites.organizationId, orgId));
        const used = row?.n ?? 0;
        return {
          allowed: used < STARTER_TRIAL_KEYWORDS,
          used,
          limit: STARTER_TRIAL_KEYWORDS,
          reason: used < STARTER_TRIAL_KEYWORDS ? null : "limit_reached",
        };
      }
    }
  }

  // leftJoin makes every plan column nullable; no plan row means no plan.
  if (
    !agency &&
    (!sub ||
      sub.articleLimit === null ||
      sub.keywordLimit === null ||
      sub.siteLimit === null)
  ) {
    return { allowed: false, used: 0, limit: 0, reason: "no_active_plan" };
  }

  // A plan row alone is not entitlement: a cancelled or unpaid subscription
  // still points at the plan it used to have.
  if (!agency && sub && !ENTITLED_STATUSES.has(sub.status)) {
    return { allowed: false, used: 0, limit: 0, reason: "subscription_inactive" };
  }

  const planLimits = agency ?? {
    articles: sub!.articleLimit!,
    keywords: sub!.keywordLimit!,
    websites: sub!.siteLimit!,
  };

  /**
   * An agency workspace has no billing period, so its monthly counts run from
   * the calendar month. Without this, periodStart would be given two nulls
   * and every article ever written would count against the monthly limit.
   */
  const from = agency
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    : periodStart(sub!.currentPeriodStart, sub!.currentPeriodEnd);

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
