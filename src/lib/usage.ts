import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { UNLIMITED, type LimitCheck } from "@/lib/usage-shared";
import { agencyLimits } from "@/lib/agency/core";
import type { QuotaRule } from "@/lib/billing/spend-quota";
import {
  billingAnchor,
  calendarMonth,
  entitlementPeriod,
} from "@/lib/billing/entitlement-period";
import {
  articles,
  keywords,
  plans,
  spendReservations,
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

export type LimitKind = "articles" | "keywords" | UsageKind;

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
 * Start of the MONTHLY allowance period for a subscription.
 *
 * Not the billing period: an annual plan's billing period is a year, and
 * using it as the usage window let an annual customer spend one month's
 * allowance and then wait eleven months. Periods are months anchored on the
 * billing anchor - see lib/billing/entitlement-period.ts for the full policy
 * (month ends, leap years, trials, upgrades, UTC).
 */
function periodStart(
  sub: {
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    interval: string | null;
    createdAt: Date | null;
  },
  now: Date = new Date(),
): Date {
  const anchor = billingAnchor(sub);
  return anchor ? entitlementPeriod(anchor, now).start : calendarMonth(now).start;
}

/**
 * The plan paying for a website, its limits and the start of its period, or
 * why there is none. Shared by checkLimit and articleAllowanceRule so the
 * display and the enforcement can never disagree.
 */
async function resolvePlan(
  websiteId: string,
  executor: Pick<typeof db, "select">,
) {
  /**
   * The owning workspace, still needed for agency limits and metered usage,
   * both of which are account-level. Read from the website rather than passed
   * in so the two can never disagree.
   */
  const [site] = await executor
    .select({ organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);

  if (!site) {
    return { ok: false as const, reason: "no_active_plan" as const };
  }
  const orgId = site.organizationId;
  /**
   * Agency workspaces are ours, not sold, so they have no subscription and
   * would otherwise fail the entitlement check below. Their limits come from
   * their own row — real numbers rather than unlimited, so an internal
   * workspace still cannot run away with cost.
   *
   * Checked first because the two branches are mutually exclusive: an agency
   * workspace never has a plan to fall back to.
   */
  const agency = await agencyLimits(orgId, executor);

  const [sub] = await executor
    .select({
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      createdAt: subscriptions.createdAt,
      interval: plans.interval,
      status: subscriptions.status,
      articleLimit: plans.articleLimit,
      keywordLimit: plans.keywordLimit,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    // This website's own subscription, not the workspace's.
    .where(eq(subscriptions.websiteId, websiteId))
    .limit(1);

  // leftJoin makes every plan column nullable; no plan row means no plan.
  if (
    !agency &&
    (!sub || sub.articleLimit === null || sub.keywordLimit === null)
  ) {
    return { ok: false as const, reason: "no_active_plan" as const };
  }

  // A plan row alone is not entitlement: a cancelled or unpaid subscription
  // still points at the plan it used to have.
  if (!agency && sub && !ENTITLED_STATUSES.has(sub.status)) {
    return { ok: false as const, reason: "subscription_inactive" as const };
  }

  const planLimits = agency ?? {
    articles: sub!.articleLimit!,
    keywords: sub!.keywordLimit!,
  };

  /**
   * An agency workspace has no billing period, so its monthly counts run from
   * the calendar month. Without this, periodStart would be given two nulls
   * and every article ever written would count against the monthly limit.
   */
  const from = agency ? calendarMonth().start : periodStart(sub!);

  return { ok: true as const, orgId, planLimits, from };
}

/** Ledger key for a website's monthly article allowance. */
export function articleAllowanceKey(websiteId: string): string {
  return `articles:${websiteId}`;
}

/**
 * Articles on this website since `from` that the ledger does not yet know
 * about - created before the ledger existed (or by old code during the
 * deploy). The same predicate as migration 0042 (which corrects 0041's) and
 * the articles_allowance_baseline trigger it installs.
 */
function uncoveredArticles(websiteId: string, from: Date) {
  const key = articleAllowanceKey(websiteId);
  return sql`
    from ${articles} a
    where a.website_id = ${websiteId}
      and a.created_at >= ${from.toISOString()}::timestamp
      and not exists (
        select 1 from ${spendReservations} r
        where r.key = ${key}
          and (
            -- The article's OWN reservation covers it in any state: one that
            -- was released (its job never ran) must not be re-counted here.
            r.subject_id = a.id::text
            or r.metadata ->> 'articleId' = a.id::text
            or (a.calendar_item_id is not null
                and r.state in ('reserved', 'consumed')
                and r.metadata ->> 'calendarItemId' = a.calendar_item_id::text)
          )
      )`;
}

/**
 * Makes legacy article consumption DURABLE: one consumed ledger row per
 * article the ledger does not know about, dated when the article was made.
 *
 * Runs under the allowance key's lock, before counting (QuotaRule.backfill),
 * and does what migration 0041 did for every site, for the articles old code
 * created after that migration ran. Once written, deleting the article
 * changes nothing - which is the point. The previous max(ledger, rows)
 * transition let deleting a legacy article hand its slot back.
 */
export async function materializeArticleBaseline(
  executor: Pick<typeof db, "execute">,
  websiteId: string,
  from: Date,
): Promise<void> {
  const key = articleAllowanceKey(websiteId);
  await executor.execute(sql`
    insert into ${spendReservations} (
      key, operation, organization_id, website_id, state, limit_value,
      counted_at, spend_outcome, consumed_at, subject_id, metadata,
      created_at, updated_at
    )
    select ${key}, 'article.legacy',
      (select w.organization_id from ${websites} w where w.id = a.website_id),
      a.website_id, 'consumed', 0, a.created_at, 'legacy', timezone('utc', now()),
      a.id::text, jsonb_build_object('source', 'baseline'), timezone('utc', now()), timezone('utc', now())
    ${uncoveredArticles(websiteId, from)}
    on conflict (operation, key, subject_id) where subject_id is not null
    do nothing`);
}

/**
 * Articles used on a website since `from`: the ledger, plus articles the
 * ledger has not absorbed yet (see materializeArticleBaseline). The two sets
 * are disjoint by construction, so nothing is counted twice, and a reserve
 * absorbs the second into the first before it counts.
 */
async function articlesUsedSince(
  executor: Pick<typeof db, "select" | "execute">,
  websiteId: string,
  from: Date,
): Promise<number> {
  const [ledger] = await executor
    .select({ n: count() })
    .from(spendReservations)
    .where(
      and(
        eq(spendReservations.key, articleAllowanceKey(websiteId)),
        inArray(spendReservations.state, ["reserved", "consumed"]),
        gte(spendReservations.countedAt, from),
      ),
    );
  const result = await executor.execute(
    sql`select count(*)::int as n ${uncoveredArticles(websiteId, from)}`,
  );
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    n: number;
  }[];
  return (ledger?.n ?? 0) + Number(rows[0]?.n ?? 0);
}

/**
 * The reservation rule for one more article this period, or why not.
 *
 * Counted from spend_reservations, not from article rows: a row can be
 * deleted, and counting rows meant generate, delete, generate again spent
 * the same slot over and over. Legacy articles are made ledger rows first
 * (backfill), so they count durably too.
 */
export async function articleAllowanceRule(
  websiteId: string,
  executor: Pick<typeof db, "select" | "execute"> = db,
): Promise<
  | { ok: true; rule: QuotaRule; organizationId: string }
  | { ok: false; reason: "no_active_plan" | "subscription_inactive" }
> {
  const plan = await resolvePlan(websiteId, executor);
  if (!plan.ok) return plan;
  return {
    ok: true,
    organizationId: plan.orgId,
    rule: {
      key: articleAllowanceKey(websiteId),
      limit: plan.planLimits.articles,
      // The monthly period, resolved in one place (resolvePlan/periodStart).
      window: { since: plan.from },
      backfill: (tx) => materializeArticleBaseline(tx, websiteId, plan.from),
    },
  };
}

/**
 * Reports usage against the organization's plan limit.
 *
 * Nothing enforces limits yet — Day 3 wires this into the paths that create
 * articles, websites and keywords. The signature is fixed now so callers do
 * not need changing later.
 */
export async function checkLimit(
  /**
   * The website whose allowance is being checked.
   *
   * Each website carries its own subscription, so the limit belongs to the
   * site rather than the account: one workspace can run a small site on
   * Launch and a busy one on Scale, and neither eats the other's articles.
   */
  websiteId: string,
  kind: LimitKind,
  /**
   * Where to run the queries. A caller holding a lock inside a transaction
   * passes the transaction, so the count it reads is the one the lock
   * protects. See queueArticleForCalendarItem.
   */
  executor: Pick<typeof db, "select" | "execute"> = db,
): Promise<LimitCheck> {
  const plan = await resolvePlan(websiteId, executor);
  if (!plan.ok) {
    return { allowed: false, used: 0, limit: 0, reason: plan.reason };
  }
  const { orgId, planLimits, from } = plan;

  let used: number;
  let limit: number;

  if (kind === "articles") {
    // This website's allowance used this period, from the ledger: deleting
    // an article does not give its slot back. See articleAllowanceRule.
    limit = planLimits.articles;
    used = await articlesUsedSince(executor, websiteId, from);
  } else if (kind === "keywords") {
    limit = planLimits.keywords;
    const [row] = await executor
      .select({ n: count() })
      .from(keywords)
      .where(eq(keywords.websiteId, websiteId));
    used = row?.n ?? 0;
  } else {
    // Metered provider usage: counted from usage_events for the period.
    limit = UNLIMITED;
    const [row] = await executor
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
  websiteId: string,
  kind: LimitKind,
): Promise<LimitCheck> {
  const check = await checkLimit(websiteId, kind);
  if (!check.allowed) {
    throw new LimitExceededError(kind, check);
  }
  return check;
}
