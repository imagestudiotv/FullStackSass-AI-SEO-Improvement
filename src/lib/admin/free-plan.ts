"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { countSupportRequests } from "@/lib/admin/free-plan-support";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { creditSettings } from "@/lib/db/schema";
import { FREE_PLAN_OBSERVATION_DAYS } from "@/lib/plans/free-plan";
import {
  FREE_PLAN_CAP_KEY,
  freePlanCostLimits,
  freePlanDaySpendCents,
  readFreePlanCap,
} from "@/lib/plans/free-plan-server";

/**
 * Admin -> Free plan launch (Daniel, 2026-11-19: "a controlled launch for
 * the first 100-500 signups, with an initial 30-day observation period.
 * Track first website connection, first article generated, first content
 * published, social scheduling, upgrade requests, AI/API spending and
 * support requests").
 *
 * READ FROM WHAT ALREADY EXISTS: the website, its CMS connection
 * (integrations), its articles (first written, first live), its social posts,
 * its checkouts and subscriptions, and usage_events for the AI and API cost.
 * Only the upgrade-prompt clicks have their own table (free_plan_events).
 * Support requests come from Crisp (countSupportRequests, wired at
 * integration). Every action checks admin access on the server.
 */

/** One Free workspace and its milestones. Dates are null until reached. */
export type FreePlanAccountRow = {
  organizationId: string;
  organizationName: string | null;
  email: string | null;
  domain: string;
  websiteId: string | null;
  startedAt: Date;
  websiteAddedAt: Date | null;
  cmsConnectedAt: Date | null;
  firstArticleAt: Date | null;
  firstPublishedAt: Date | null;
  articles: number;
  socialScheduled: number;
  upgradeClicks: number;
  checkoutsStarted: number;
  converted: boolean;
  /** Recorded AI and API cost since starting Free, and this UTC month, in US cents. */
  spendTotalCents: number;
  spendMonthCents: number;
  /** Crisp conversations (countSupportRequests); null until wired. */
  supportRequests: number | null;
};

export type FreePlanLaunch = {
  cap: number;
  capFromSetting: boolean;
  taken: number;
  /** The first Free start: the launch, and the observation window's first day. */
  launchedAt: Date | null;
  windowEndsAt: Date | null;
  monthlyCapCents: number;
  dailyBudgetCents: number;
  todaySpendCents: number;
  totals: {
    spendCents: number;
    averageCents: number;
    converted: number;
    upgradeClicks: number;
    checkoutsStarted: number;
    withArticle: number;
    withPublished: number;
    withSocial: number;
    withCms: number;
    supportRequests: number | null;
  };
  /** The last 30 UTC days of Free AI/API cost, oldest first, in US cents. */
  perDay: { day: string; cents: number }[];
  accounts: FreePlanAccountRow[];
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown) => (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Row[];
const date = (value: unknown) => (value ? new Date(value as string) : null);
const cents = (usd: unknown) => Math.round(Number(usd ?? 0) * 100);

export async function getFreePlanLaunch(now: Date = new Date()): Promise<FreePlanLaunch> {
  await requireAdmin();

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const accounts = rowsOf(
    await db.execute(sql`
      select
        f.organization_id, f.user_id, o.name as organization_name, u.email, f.domain, f.website_id, f.started_at,
        w.created_at as website_added_at,
        (select min(coalesce(i.verified_at, i.created_at)) from integrations i
          where i.website_id = f.website_id and i.status <> 'disconnected') as cms_connected_at,
        (select min(a.created_at) from articles a where a.website_id = f.website_id) as first_article_at,
        (select min(a.first_live_at) from articles a where a.website_id = f.website_id) as first_published_at,
        (select count(*)::int from articles a where a.website_id = f.website_id) as articles,
        (select count(*)::int from social_suggestions s
          where s.website_id = f.website_id and (s.scheduled_for is not null or s.status in ('scheduled', 'posting', 'posted'))) as social_scheduled,
        (select count(*)::int from free_plan_events e
          where e.organization_id = f.organization_id and e.kind = 'upgrade_click') as upgrade_clicks,
        (select count(*)::int from billing_checkouts c
          where c.organization_id = f.organization_id and c.created_at >= f.started_at) as checkouts_started,
        exists (select 1 from subscriptions s
          where s.organization_id = f.organization_id and s.plan_id is not null
            and s.status in ('active', 'trialing', 'past_due')
            and (s.stripe_subscription_id is not null or s.paypal_subscription_id is not null)) as converted,
        (select coalesce(sum(ue.cost_usd), 0) from usage_events ue
          where ue.organization_id = f.organization_id and ue.created_at >= f.started_at) as spend_total,
        (select coalesce(sum(ue.cost_usd), 0) from usage_events ue
          where ue.organization_id = f.organization_id and ue.created_at >= ${monthStart.toISOString()}::timestamp) as spend_month
      from free_plan_accounts f
      left join organization o on o.id = f.organization_id
      left join "user" u on u.id = f.user_id
      left join websites w on w.id = f.website_id
      order by f.started_at desc
    `),
  );

  const userIds = accounts.map((row) => row.user_id as string | undefined).filter(Boolean) as string[];
  const support = await countSupportRequests(userIds);

  const rows: FreePlanAccountRow[] = accounts.map((row) => ({
    organizationId: row.organization_id as string,
    organizationName: (row.organization_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    domain: row.domain as string,
    websiteId: (row.website_id as string | null) ?? null,
    startedAt: date(row.started_at)!,
    websiteAddedAt: date(row.website_added_at),
    cmsConnectedAt: date(row.cms_connected_at),
    firstArticleAt: date(row.first_article_at),
    firstPublishedAt: date(row.first_published_at),
    articles: Number(row.articles ?? 0),
    socialScheduled: Number(row.social_scheduled ?? 0),
    upgradeClicks: Number(row.upgrade_clicks ?? 0),
    checkoutsStarted: Number(row.checkouts_started ?? 0),
    converted: Boolean(row.converted),
    spendTotalCents: cents(row.spend_total),
    spendMonthCents: cents(row.spend_month),
    supportRequests: support === null ? null : (support.get(row.user_id as string) ?? 0),
  }));

  const since = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const perDayRows = rowsOf(
    await db.execute(sql`
      select to_char(date_trunc('day', ue.created_at), 'YYYY-MM-DD') as day, coalesce(sum(ue.cost_usd), 0) as usd
      from usage_events ue
      join free_plan_accounts f on f.organization_id = ue.organization_id and ue.created_at >= f.started_at
      where ue.created_at >= ${new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate())).toISOString()}::timestamp
      group by 1
    `),
  );
  const byDay = new Map(perDayRows.map((row) => [row.day as string, cents(row.usd)]));
  const perDay = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(since.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { day, cents: byDay.get(day) ?? 0 };
  });

  const [setting] = await db.select({ value: creditSettings.value }).from(creditSettings).where(sql`${creditSettings.key} = ${FREE_PLAN_CAP_KEY}`);
  const launchedAt = rows.length ? new Date(Math.min(...rows.map((row) => row.startedAt.getTime()))) : null;
  const spendCents = rows.reduce((sum, row) => sum + row.spendTotalCents, 0);
  const limits = freePlanCostLimits();

  return {
    cap: await readFreePlanCap(),
    capFromSetting: Boolean(setting),
    taken: rows.length,
    launchedAt,
    windowEndsAt: launchedAt ? new Date(launchedAt.getTime() + FREE_PLAN_OBSERVATION_DAYS * 24 * 60 * 60 * 1000) : null,
    monthlyCapCents: limits.monthlyCapCents,
    dailyBudgetCents: limits.dailyBudgetCents,
    todaySpendCents: await freePlanDaySpendCents(now),
    totals: {
      spendCents,
      averageCents: rows.length ? Math.round(spendCents / rows.length) : 0,
      converted: rows.filter((row) => row.converted).length,
      upgradeClicks: rows.reduce((sum, row) => sum + row.upgradeClicks, 0),
      checkoutsStarted: rows.filter((row) => row.checkoutsStarted > 0).length,
      withArticle: rows.filter((row) => row.firstArticleAt).length,
      withPublished: rows.filter((row) => row.firstPublishedAt).length,
      withSocial: rows.filter((row) => row.socialScheduled > 0).length,
      withCms: rows.filter((row) => row.cmsConnectedAt).length,
      supportRequests: support === null ? null : [...support.values()].reduce((sum, n) => sum + n, 0),
    },
    perDay,
    accounts: rows,
  };
}

/** The highest cap the form accepts: a typo of 50000 would open Free to everyone. */
const MAX_CAP = 10_000;

/**
 * Sets the launch cap, without a deploy (credit_settings "free_plan_cap").
 * Lowering it below the accounts already started closes Free to new
 * sign-ups and takes nothing from those already on it.
 */
export async function setFreePlanCap(value: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const cap = Math.floor(Number(value));
  if (!Number.isFinite(cap) || cap < 0 || cap > MAX_CAP) {
    return { ok: false, error: `The cap must be a whole number from 0 to ${MAX_CAP}.` };
  }
  const before = await readFreePlanCap();
  await db
    .insert(creditSettings)
    .values({ key: FREE_PLAN_CAP_KEY, value: cap, updatedBy: admin.email, updatedAt: new Date() })
    .onConflictDoUpdate({ target: creditSettings.key, set: { value: cap, updatedBy: admin.email, updatedAt: new Date() } });
  await recordAdminAction({
    actorEmail: admin.email,
    action: "free_plan.cap_changed",
    targetType: "setting",
    targetId: FREE_PLAN_CAP_KEY,
    summary: `Free plan launch cap: ${before} -> ${cap}`,
    detail: { before, after: cap },
  });
  revalidatePath("/admin/free-plan");
  revalidatePath("/pricing");
  return { ok: true };
}
