import "server-only";

import { and, count, eq, gte, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { calendarMonth } from "@/lib/billing/entitlement-period";
import { db, isDatabaseConfigured } from "@/lib/db";
import {
  audits,
  creditLedger,
  creditSettings,
  freePlanAccounts,
  freePlanEvents,
  geoResults,
  plans,
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

/** A workspace's recorded AI and API cost this UTC month, in US cents (usage_events). */
export async function freePlanMonthSpendCents(organizationId: string, now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ usd: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.organizationId, organizationId), gte(usageEvents.createdAt, calendarMonth(now).start)));
  return cents(row?.usd);
}

/**
 * Every Free workspace's recorded AI cost today (UTC), in US cents. A
 * workspace that has since bought a plan is no longer counted: its spend is
 * paid for.
 */
export async function freePlanDaySpendCents(now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<number> {
  const [row] = await executor
    .select({ usd: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(
      and(
        gte(usageEvents.createdAt, startOfUtcDay(now)),
        sql`${usageEvents.organizationId} in (
          select f.organization_id from ${freePlanAccounts} f
          where not exists (
            select 1 from ${subscriptions} s
            where s.organization_id = f.organization_id
              and s.status in ('active', 'trialing', 'past_due')
              and s.plan_id is not null
          )
        )`,
      ),
    );
  return cents(row?.usd);
}

export type FreePlanPause = { paused: false } | { paused: true; reason: "monthly_cap" | "daily_budget" };

/**
 * Whether Free AI generation is paused for this workspace: its own month's
 * AI cost has reached FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS, or all Free
 * workspaces together have reached FREE_PLAN_DAILY_AI_BUDGET_CENTS today.
 *
 * Read from what was RECORDED, so it trails the spend by the call in flight:
 * the cap can be passed by at most one article's cost, never run away.
 */
export async function freePlanPause(organizationId: string, now: Date = new Date(), executor: Pick<Executor, "select"> = db): Promise<FreePlanPause> {
  const limits = freePlanCostLimits();
  if (limits.dailyBudgetCents === 0) return { paused: true, reason: "daily_budget" };
  const [month, day] = await Promise.all([
    freePlanMonthSpendCents(organizationId, now, executor),
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

/** The ledger key of a Free workspace's credits for one month. */
export function freePlanGrantKey(organizationId: string, now: Date): string {
  return `free_plan:${organizationId}:${now.toISOString().slice(0, 7)}`;
}

/**
 * Free's social posts, paid like every plan's: in credits (1 a post, Admin ->
 * Credits), FREE_PLAN.socialPostsPerMonth of them each UTC month. Granted
 * where the paid plans' monthly credits are (lib/backlinks/credits.ts
 * ensureMonthlyCredits), once per month by its idempotency key. Like every
 * credit they do not expire.
 */
export async function grantFreePlanCredits(organizationId: string, now: Date = new Date()): Promise<boolean> {
  const websiteId = await freePlanWebsiteOf(organizationId);
  if (!websiteId) return false;
  // Written here rather than through recordCredit (lib/backlinks/credits.ts), which calls this: no import cycle.
  const key = freePlanGrantKey(organizationId, now);
  const rows = await db
    .insert(creditLedger)
    .values({
      organizationId,
      type: "plan_grant",
      amount: FREE_PLAN.socialPostsPerMonth,
      referenceId: key,
      note: "Free plan: this month's social posts",
      idempotencyKey: key,
    })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return rows.length > 0;
}

/** Where an upgrade prompt was pressed, for the launch dashboard. */
export async function recordFreePlanEvent(input: { organizationId: string; userId: string | null; kind: "upgrade_click"; source: string }): Promise<void> {
  try {
    const [row] = await db
      .select({ id: freePlanAccounts.id })
      .from(freePlanAccounts)
      .where(eq(freePlanAccounts.organizationId, input.organizationId))
      .limit(1);
    // Only Free workspaces are tracked: the dashboard is about them.
    if (!row) return;
    await db.insert(freePlanEvents).values({
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.kind,
      source: input.source.slice(0, 80),
    });
  } catch (error) {
    console.error("[free-plan] could not record an event", error);
  }
}
