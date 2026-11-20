import "server-only";

import { and, count, eq, gte, inArray, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { calendarMonth } from "@/lib/billing/entitlement-period";
import { db, isDatabaseConfigured } from "@/lib/db";
import {
  audits,
  creditSettings,
  freePlanAccounts,
  freePlanEvents,
  geoResults,
  plans,
  socialSuggestions,
  subscriptions,
  usageEvents,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import {
  FREE_PLAN,
  FREE_PLAN_DEFAULT_CAP,
  freePlanCounter,
  isRetiredFromSale,
  type FreePlanCounter,
} from "@/lib/plans/free-plan";

/**
 * The Free plan's server side (lib/plans/free-plan.ts has what it includes):
 * the launch cap and counter, starting Free, the AI cost protection, and the
 * monthly allowances that are not article or keyword counts.
 *
 * A website is ON FREE when its workspace started Free for it (a
 * free_plan_accounts row) and it has no entitled subscription - a plan, once
 * bought, always wins (lib/usage.ts resolvePlan).
 */

/** Statuses that mean the website pays (lib/usage.ts ENTITLED_STATUSES). */
const PAYING_STATUSES = ["active", "trialing", "past_due"];

/** credit_settings key of the launch cap (Admin -> Free plan launch). */
export const FREE_PLAN_CAP_KEY = "free_plan_cap";

/** One lock for every admission, so two sign-ups at 499 / 500 are counted one after the other. */
const CAP_LOCK = "free-plan:cap";

/**
 * The AI cost protection (Daniel: "The real danger: AI generation expenses").
 * Both in US cents: the providers bill in dollars, and usage_events.cost_usd
 * records dollars.
 *
 * - per account: a Free workspace's AI cost this UTC month; at the cap its
 *   Free generation pauses until next month (or it upgrades).
 * - per day: every Free workspace's AI cost today, together; at the budget
 *   ALL Free generation pauses until tomorrow (UTC). 0 stops it outright - the
 *   kill switch.
 */
export const FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS_DEFAULT = 300;
export const FREE_PLAN_DAILY_AI_BUDGET_CENTS_DEFAULT = 2500;

function envCents(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function freePlanCostLimits(): { monthlyCapCents: number; dailyBudgetCents: number } {
  return {
    monthlyCapCents: envCents("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS_DEFAULT),
    dailyBudgetCents: envCents("FREE_PLAN_DAILY_AI_BUDGET_CENTS", FREE_PLAN_DAILY_AI_BUDGET_CENTS_DEFAULT),
  };
}

/** A stored domain as Free compares it: lower-case, without "www.". */
export function freePlanDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * The launch cap: the administrator's setting (Admin -> Free plan launch,
 * credit_settings "free_plan_cap"), else FREE_PLAN_CAP, else 500.
 */
export async function readFreePlanCap(executor: Pick<Executor, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ value: creditSettings.value })
    .from(creditSettings)
    .where(eq(creditSettings.key, FREE_PLAN_CAP_KEY))
    .limit(1);
  if (row) return row.value;
  return envCents("FREE_PLAN_CAP", FREE_PLAN_DEFAULT_CAP);
}

/** Free accounts started since launch: the counter's "430". */
export async function countFreePlanAccounts(executor: Pick<Executor, "select"> = db): Promise<number> {
  const [row] = await executor.select({ n: count() }).from(freePlanAccounts);
  return Number(row?.n ?? 0);
}

/**
 * The launch counter for the card ("430 / 500 free spots taken"). Null when
 * there is no database to read (a build without one) - the card then shows
 * no counter rather than a made-up one.
 */
export async function getFreePlanCounter(): Promise<FreePlanCounter | null> {
  if (!isDatabaseConfigured()) return null;
  const [taken, cap] = await Promise.all([countFreePlanAccounts(), readFreePlanCap()]);
  return freePlanCounter(taken, cap);
}

export type StartFreePlanInput = {
  organizationId: string;
  userId: string | null;
  websiteId: string;
  /** The signed-in address is confirmed (Better Auth user.emailVerified). */
  emailVerified: boolean;
};

export type StartFreePlanRefusal =
  | "email_unverified"
  | "not_found"
  | "has_plan"
  | "other_website"
  | "domain_taken"
  | "full";

export type StartFreePlanResult =
  | { ok: true; alreadyStarted: boolean }
  | { ok: false; reason: StartFreePlanRefusal };

/**
 * Starts Free for one website of a workspace.
 *
 * IDEMPOTENT: a second press, a retry or a refresh for the same website
 * answers `{ ok: true, alreadyStarted: true }` and writes nothing.
 *
 * THE CAP IS EXACT. Every admission takes one transaction-scoped advisory
 * lock, counts the rows and inserts under it, so two sign-ups arriving at
 * 499 / 500 are admitted one after the other and only the first gets the
 * last spot. The unique indexes (workspace, website, domain) back the
 * checks up if anything ever bypasses the lock.
 *
 * Refused: an unconfirmed email (abuse: one confirmed address per Free
 * start), a website that is not the workspace's, a website that already
 * pays, a workspace whose Free start is another website, a domain already on
 * another Free account, and every start once the cap is reached - those
 * sign-ups get no Free allowance; the card sends them to the paid plans'
 * free trial instead.
 *
 * A workspace whose Free website was deleted may start Free again for a new
 * one: the row moves to it (the old domain is released).
 */
export async function startFreePlan(input: StartFreePlanInput, executor: Executor = db): Promise<StartFreePlanResult> {
  if (!input.emailVerified) return { ok: false, reason: "email_unverified" };

  return executor.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CAP_LOCK}))`);

    const [site] = await tx
      .select({ id: websites.id, domain: websites.domain })
      .from(websites)
      .where(and(eq(websites.id, input.websiteId), eq(websites.organizationId, input.organizationId)))
      .limit(1);
    if (!site) return { ok: false as const, reason: "not_found" as const };

    const [mine] = await tx
      .select({ id: freePlanAccounts.id, websiteId: freePlanAccounts.websiteId })
      .from(freePlanAccounts)
      .where(eq(freePlanAccounts.organizationId, input.organizationId))
      .limit(1);
    if (mine?.websiteId === site.id) return { ok: true as const, alreadyStarted: true };
    if (mine && mine.websiteId !== null) return { ok: false as const, reason: "other_website" as const };

    const [paying] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.websiteId, site.id), inArray(subscriptions.status, PAYING_STATUSES)))
      .limit(1);
    if (paying) return { ok: false as const, reason: "has_plan" as const };

    const domain = freePlanDomain(site.domain);
    const [taken] = await tx
      .select({ organizationId: freePlanAccounts.organizationId })
      .from(freePlanAccounts)
      .where(eq(freePlanAccounts.domain, domain))
      .limit(1);
    if (taken && taken.organizationId !== input.organizationId) return { ok: false as const, reason: "domain_taken" as const };

    if (mine) {
      // The Free website was deleted: Free moves to this one. Not a new spot.
      await tx
        .update(freePlanAccounts)
        .set({ websiteId: site.id, domain, userId: input.userId })
        .where(eq(freePlanAccounts.id, mine.id));
      return { ok: true as const, alreadyStarted: false };
    }

    const [cap, used] = await Promise.all([readFreePlanCap(tx), countFreePlanAccounts(tx)]);
    if (used >= cap) return { ok: false as const, reason: "full" as const };

    await tx.insert(freePlanAccounts).values({
      organizationId: input.organizationId,
      websiteId: site.id,
      domain,
      userId: input.userId,
    });
    return { ok: true as const, alreadyStarted: false };
  });
}

/**
 * Whether this website is on Free now: started Free and not paying. The one
 * question every Free gate asks (lib/usage.ts asks it inside resolvePlan).
 */
export async function isFreePlanWebsite(websiteId: string, executor: Pick<Executor, "select"> = db): Promise<boolean> {
  const [row] = await executor
    .select({ id: freePlanAccounts.id })
    .from(freePlanAccounts)
    .where(
      and(
        eq(freePlanAccounts.websiteId, websiteId),
        sql`not exists (
          select 1 from ${subscriptions} s
          where s.website_id = ${websiteId}
            and s.status in ('active', 'trialing', 'past_due')
            and s.plan_id is not null
        )`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * isFreePlanWebsite as SQL, for queries over many websites (the Partner
 * Network's beneficiary list, lib/admin/network.ts).
 */
export function onFreePlan(websiteId: AnyColumn | SQL): SQL {
  return sql`exists (
    select 1 from ${freePlanAccounts} fp
    where fp.website_id = ${websiteId}
      and not exists (
        select 1 from ${subscriptions} fs
        where fs.website_id = fp.website_id
          and fs.status in ('active', 'trialing', 'past_due')
          and fs.plan_id is not null
      )
  )`;
}

/** The workspace's Free website, if the workspace is on Free (for the app shell's indicator). */
export async function freePlanWebsiteOf(organizationId: string, executor: Pick<Executor, "select"> = db): Promise<string | null> {
  const [row] = await executor
    .select({ websiteId: freePlanAccounts.websiteId })
    .from(freePlanAccounts)
    .where(eq(freePlanAccounts.organizationId, organizationId))
    .limit(1);
  if (!row?.websiteId) return null;
  return (await isFreePlanWebsite(row.websiteId, executor)) ? row.websiteId : null;
}

/**
 * Whether a checkout for this tier may start on this website: any tier on
 * sale, and a tier retired from sale (Launch) only for a website already on
 * it - so a Launch subscriber can still switch between monthly and yearly,
 * while nobody new can buy it. The website's ownership is checked by the
 * caller.
 */
export async function mayCheckoutTier(websiteId: string, tier: string): Promise<boolean> {
  if (!isRetiredFromSale(tier)) return true;
  const [row] = await db
    .select({ tier: plans.tier })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.websiteId, websiteId), inArray(subscriptions.status, PAYING_STATUSES)))
    .limit(1);
  return row?.tier === tier;
}

/**
 * Whether a WORKSPACE is on Free for what is counted per workspace (Growth
 * Copilot's messages of the day): it has its Free website and pays for no
 * website at all. A workspace paying for any site keeps the paid allowance.
 */
export async function isFreeWorkspace(organizationId: string, executor: Pick<Executor, "select"> = db): Promise<boolean> {
  const [row] = await executor
    .select({ id: freePlanAccounts.id })
    .from(freePlanAccounts)
    .where(
      and(
        eq(freePlanAccounts.organizationId, organizationId),
        sql`${freePlanAccounts.websiteId} is not null`,
        sql`not exists (
          select 1 from ${subscriptions} s
          where s.organization_id = ${organizationId}
            and s.status in ('active', 'trialing', 'past_due')
            and s.plan_id is not null
        )`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

const cents = (usd: string | number | null | undefined) => Math.round(Number(usd ?? 0) * 100);

const startOfUtcDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * Which usage_events rows are a Free website's AI and API cost: what the
 * monthly cap, the day's budget and the launch dashboard add up. The caller
 * also scopes the rows to the website's workspace, which is what
 * usage_events is indexed by (usage_events_org_created_idx).
 *
 * PER WEBSITE, NOT PER WORKSPACE. A workspace may pay for one website and
 * keep its Free one beside it (startFreePlan asks only whether THIS website
 * pays). The paid website's spend is paid for: it must not pause the Free
 * one, nor show on the dashboard as what Free costs.
 *
 * Every AI or API call a Free website can reach records its website (the
 * lib/usage.ts track callers: articles with their research and pictures,
 * the website check and audit, AI visibility, Growth Copilot, social
 * suggestions). A row without one belongs to a deleted website
 * (usage_events.website_id is set null on delete). Those rows count while
 * the workspace pays for no website, so deleting the Free website and
 * starting Free on a new one (startFreePlan) does not hand the month's
 * budget back. A workspace that pays keeps them out: they may be its paid
 * website's.
 */
export function freePlanSpendOf(websiteId: AnyColumn | SQL | string, organizationId: AnyColumn | SQL | string): SQL {
  return sql`(${usageEvents.websiteId} = ${websiteId} or (${usageEvents.websiteId} is null and not exists (
    select 1 from ${subscriptions} fs
    where fs.organization_id = ${organizationId}
      and fs.status in ('active', 'trialing', 'past_due')
      and fs.plan_id is not null
  )))`;
}

/** A Free website's recorded AI and API cost this UTC month, in US cents (usage_events, freePlanSpendOf). */
export async function freePlanMonthSpendCents(websiteId: string, now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<number> {
  const [site] = await executor.select({ organizationId: websites.organizationId }).from(websites).where(eq(websites.id, websiteId)).limit(1);
  if (!site) return 0;
  const [row] = await executor
    .select({ usd: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, site.organizationId),
        gte(usageEvents.createdAt, calendarMonth(now).start),
        freePlanSpendOf(websiteId, site.organizationId),
      ),
    );
  return cents(row?.usd);
}

/**
 * Every Free website's recorded AI cost today (UTC), in US cents. A website
 * that has since bought a plan is no longer counted: its spend is paid for.
 * Nor is the paid website of a workspace that also keeps a Free one
 * (freePlanSpendOf).
 */
export async function freePlanDaySpendCents(now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ usd: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(
      and(
        gte(usageEvents.createdAt, startOfUtcDay(now)),
        sql`exists (
          select 1 from ${freePlanAccounts} f
          where f.organization_id = ${usageEvents.organizationId}
            and f.website_id is not null
            and not exists (
              select 1 from ${subscriptions} s
              where s.website_id = f.website_id
                and s.status in ('active', 'trialing', 'past_due')
                and s.plan_id is not null
            )
            and ${freePlanSpendOf(sql`f.website_id`, sql`f.organization_id`)}
        )`,
      ),
    );
  return cents(row?.usd);
}

export type FreePlanPause = { paused: false } | { paused: true; reason: "monthly_cap" | "daily_budget" };

/**
 * Whether Free AI generation is paused for this website: its own month's
 * AI cost has reached FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS, or all Free
 * websites together have reached FREE_PLAN_DAILY_AI_BUDGET_CENTS today.
 *
 * Read from what was RECORDED, so it trails the spend by the call in flight:
 * the cap can be passed by at most one article's cost, never run away.
 */
export async function freePlanPause(websiteId: string, now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<FreePlanPause> {
  const limits = freePlanCostLimits();
  if (limits.dailyBudgetCents === 0) return { paused: true, reason: "daily_budget" };
  const [month, day] = await Promise.all([
    freePlanMonthSpendCents(websiteId, now, executor),
    freePlanDaySpendCents(now, executor),
  ]);
  if (month >= limits.monthlyCapCents) return { paused: true, reason: "monthly_cap" };
  if (day >= limits.dailyBudgetCents) return { paused: true, reason: "daily_budget" };
  return { paused: false };
}

/** SEO audits run on this website this UTC month (Free: FREE_PLAN.auditsPerMonth). */
export async function freePlanAuditsThisMonth(websiteId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(audits)
    .where(and(eq(audits.websiteId, websiteId), gte(audits.createdAt, calendarMonth(now).start)));
  return Number(row?.n ?? 0);
}

/**
 * AI visibility snapshots this UTC month: days with results, as one check
 * writes its results together (Free: FREE_PLAN.visibilitySnapshotsPerMonth).
 */
export async function freePlanSnapshotsThisMonth(websiteId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct date_trunc('day', ${geoResults.checkedAt}))::int` })
    .from(geoResults)
    .where(and(eq(geoResults.websiteId, websiteId), gte(geoResults.checkedAt, calendarMonth(now).start)));
  return Number(row?.n ?? 0);
}

/**
 * Social posts this Free website has had this UTC month: handed to the
 * platform by RepGet (lib/social/publish.ts) or posted with one click
 * (lib/social/actions.ts). A post the platform refused is "failed" and not
 * counted, so trying it again does not cost a second one of the month's.
 */
export async function freePlanPostsThisMonth(websiteId: string, now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<number> {
  const { start } = calendarMonth(now);
  const [row] = await executor
    .select({ n: count() })
    .from(socialSuggestions)
    .where(
      and(
        eq(socialSuggestions.websiteId, websiteId),
        inArray(socialSuggestions.status, ["posting", "posted"]),
        // Posted: when it went out. Still posting: when it was handed over (no postedAt yet).
        or(gte(socialSuggestions.postedAt, start), and(isNull(socialSuggestions.postedAt), gte(socialSuggestions.updatedAt, start))),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Takes one of Free's FREE_PLAN.socialPostsPerMonth posts for this UTC
 * month, INSIDE the transaction that marks the post posting or posted - false
 * when the month's are used.
 *
 * A HARD LIMIT, NOT CREDITS. Free's posts used to be 8 credits granted each
 * month; credits never expire, so unused months piled up (16, 24...) and
 * paid for Copilot messages as well. Free's posts are now part of the plan,
 * like its monthly audit: no credit is charged for them and none granted,
 * and credits a Free workspace buys do not post more (they pay for Growth
 * Copilot past its free messages). A per-website lock
 * (`free-plan:social:<website>`) makes two posts at once count one after
 * the other, so the eighth cannot be taken twice. A transaction is needed
 * for the lock to hold until the post's own write commits.
 */
export async function takeFreePlanPost(tx: Executor, websiteId: string, now: Date = new Date()): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`free-plan:social:${websiteId}`}))`);
  return (await freePlanPostsThisMonth(websiteId, now, tx)) < FREE_PLAN.socialPostsPerMonth;
}

/** The shortest gap between two recorded clicks of one prompt by one workspace. */
const EVENT_THROTTLE_MS = 60 * 1000;

/**
 * Where an upgrade prompt was pressed, for the launch dashboard. At most one
 * row per workspace and prompt a minute: the action is a public endpoint,
 * and a double click or a script must not fill the table or the count.
 */
export async function recordFreePlanEvent(
  input: { organizationId: string; userId: string | null; kind: "upgrade_click"; source: string },
  now: Date = new Date(),
): Promise<void> {
  try {
    const [row] = await db
      .select({ id: freePlanAccounts.id })
      .from(freePlanAccounts)
      .where(eq(freePlanAccounts.organizationId, input.organizationId))
      .limit(1);
    // Only Free workspaces are tracked: the dashboard is about them.
    if (!row) return;
    const source = input.source.slice(0, 80);
    const [recent] = await db
      .select({ id: freePlanEvents.id })
      .from(freePlanEvents)
      .where(
        and(
          eq(freePlanEvents.organizationId, input.organizationId),
          eq(freePlanEvents.kind, input.kind),
          eq(freePlanEvents.source, source),
          gte(freePlanEvents.createdAt, new Date(now.getTime() - EVENT_THROTTLE_MS)),
        ),
      )
      .limit(1);
    if (recent) return;
    await db.insert(freePlanEvents).values({
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.kind,
      source,
      createdAt: now,
    });
  } catch (error) {
    console.error("[free-plan] could not record an event", error);
  }
}
