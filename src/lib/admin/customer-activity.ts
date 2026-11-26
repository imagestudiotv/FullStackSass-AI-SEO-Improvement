import "server-only";

import { inArray, sql, type SQL } from "drizzle-orm";

import {
  analysisFailed,
  articleFailed,
  describeActivity,
  isActivityKind,
  isOurWorkspace,
  kindsForGroup,
  noContentPlan,
  noPlanDue,
  paymentFailed,
  planBadge,
  sortAttention,
  trialEndingNoArticle,
  trialNoArticle,
  workspaceInScope,
  type ActivityEvent,
  type ActivityFilters,
  type ActivityKind,
  type AttentionItem,
  type NoPlanFacts,
  type PlanBadge,
  type RawActivity,
  type TrialFacts,
  type WorkspaceFacts,
} from "@/lib/admin/customer-activity-rules";
import { adminEmails, requireAdmin } from "@/lib/admin/guard";
import { firstArticleStatus, type FirstArticleStatus } from "@/lib/articles/first-article-status";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";

/**
 * Admin -> Customer activity (owner, 2026-11-26: "I have to check the
 * activities of the new customers in real time"): one feed of what customers
 * did and what happened to them, a per-workspace timeline, and the "Needs
 * attention" box. Admin ONLY, READ ONLY: no write, no AI call, no secret or
 * token is selected (emails, names, domains, titles and amounts only).
 *
 * Every event comes from a timestamp the product already stores; the words
 * and the rules are in customer-activity-rules.ts. Each branch of the feed's
 * union is bounded by its own timestamp and LIMIT, and the whole by
 * FEED_LIMIT; the workspaces, websites and plan badges are read once for all
 * rows (no query per row). The only per-row reads are firstArticleStatus,
 * for at most NO_PLAN_CHECKS websites of the attention box and the
 * timeline's own websites - the same helper Admin -> Websites calls per row.
 */

export const FEED_LIMIT = 300;
export const TIMELINE_LIMIT = 500;
const WORKSPACE_LIMIT = 5000;
const ATTENTION_LIMIT = 50;
const NO_PLAN_CANDIDATES = 25;
const NO_PLAN_CHECKS = 15;
const TIMELINE_WEBSITES = 20;

type Row = Record<string, unknown>;
const rowsOf = (result: unknown) => (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Row[];
/** Timestamps leave the database as UTC ISO text, so no driver can read them in local time. */
const ISO = sql.raw(`'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`);
const iso = (value: Date) => sql`${value.toISOString()}::timestamp`;
const dateOf = (value: unknown) => (value ? new Date(value as string) : null);
const text = (value: unknown) => (value === null || value === undefined ? null : String(value));
const jsonOf = <T>(value: unknown, fallback: T): T => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
};

/** INTERNAL_TEST_WEBSITE_IDS, as lib/billing/internal-testing.ts reads it. */
function internalWebsiteIds(): string[] {
  return (process.env.INTERNAL_TEST_WEBSITE_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

/* ------------------------------------------------------------------------- */
/* Workspaces                                                                 */
/* ------------------------------------------------------------------------- */

/** Every workspace (or one), with what the badge, the filters and "ours" need. One query. */
export async function workspaceFacts(organizationId?: string): Promise<WorkspaceFacts[]> {
  const rows = rowsOf(
    await db.execute(sql`
      select o.id, o.name, to_char(o.created_at, ${ISO}) as created_at,
        (select u.email from member m join "user" u on u.id = m.user_id
          where m.organization_id = o.id
          order by case when m.role = 'owner' then 0 else 1 end, m.created_at limit 1) as owner_email,
        coalesce((select json_agg(lower(u.email)) from member m join "user" u on u.id = m.user_id
          where m.organization_id = o.id), '[]'::json) as member_emails,
        coalesce((select json_agg(json_build_object('id', w.id, 'domain', w.domain)) from websites w
          where w.organization_id = o.id), '[]'::json) as sites,
        exists (select 1 from agency_workspaces ag where ag.organization_id = o.id) as agency,
        exists (select 1 from free_plan_accounts f where f.organization_id = o.id) as on_free,
        sub.status as sub_status, sub.name as plan_name, sub.tier as plan_tier
      from organization o
      left join lateral (
        select x.status, p.name, p.tier from subscriptions x
        left join plans p on p.id = x.plan_id
        where x.organization_id = o.id and x.plan_id is not null
        order by case x.status when 'active' then 0 when 'trialing' then 1 when 'past_due' then 2 else 3 end, x.created_at desc
        limit 1
      ) sub on true
      ${organizationId ? sql`where o.id = ${organizationId}` : sql``}
      order by o.created_at desc
      limit ${WORKSPACE_LIMIT}
    `),
  );
  return rows.map((row) => {
    const sites = jsonOf<{ id: string; domain: string }[]>(row.sites, []);
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      createdAt: dateOf(row.created_at) ?? new Date(0),
      ownerEmail: text(row.owner_email),
      memberEmails: jsonOf<string[]>(row.member_emails, []).filter(Boolean),
      domains: sites.map((site) => site.domain),
      websiteIds: sites.map((site) => String(site.id)),
      agency: Boolean(row.agency),
      onFree: Boolean(row.on_free),
      subscription: row.sub_status
        ? { status: String(row.sub_status), planName: text(row.plan_name), tier: text(row.plan_tier) }
        : null,
    };
  });
}

/* ------------------------------------------------------------------------- */
/* The events union                                                           */
/* ------------------------------------------------------------------------- */

type EventQuery = {
  kinds: ActivityKind[];
  /** Workspace ids the events must belong to; null for every workspace. */
  scope: string[] | null;
  since: Date | null;
  before: Date | null;
  now: Date;
  limit: number;
  /** Sign-ups with no workspace yet: shown only with no workspace filter (null = never). */
  orphans: { search: string; hideEmails: string[] } | null;
};

/** One branch: the kinds it can produce and its SELECT, with the window applied to `at`. */
type Branch = { kinds: ActivityKind[]; select: (window: (column: string) => SQL, limit: number) => SQL };

const COLUMNS = sql.raw("kind, at, org_id, website_id, ref_id, label, extra, amount, article_id");
const inScope = (column: string) => sql`${sql.raw(column)} in (select id from scope)`;

function branches(query: EventQuery): Branch[] {
  const orphan = query.orphans
    ? sql`(mo.organization_id is null
        and not exists (select 1 from jsonb_array_elements_text(${JSON.stringify(query.orphans.hideEmails)}::jsonb) h(e) where h.e = lower(u.email))
        ${query.orphans.search ? sql`and strpos(lower(u.email), ${query.orphans.search.toLowerCase()}) > 0` : sql``})`
    : sql`false`;
  return [
    {
      kinds: ["signup"],
      select: (w, limit) => sql`
        select 'signup' as kind, u.created_at as at, mo.organization_id as org_id, null::text as website_id,
          u.id as ref_id, u.email as label, null::text as extra, null::int as amount, null::text as article_id
        from "user" u
        left join lateral (
          select m.organization_id from member m where m.user_id = u.id
          order by case when m.role = 'owner' then 0 else 1 end, m.created_at limit 1
        ) mo on true
        where ${w("u.created_at")} and (${inScope("mo.organization_id")} or ${orphan})
        order by at desc limit ${limit}`,
    },
    {
      kinds: ["workspace_created"],
      select: (w, limit) => sql`
        select 'workspace_created', o.created_at, o.id, null::text, o.id, o.name, null::text, null::int, null::text
        from organization o
        where ${w("o.created_at")} and ${inScope("o.id")}
        order by o.created_at desc limit ${limit}`,
    },
    {
      kinds: ["website_added"],
      select: (w, limit) => sql`
        select 'website_added', ws.created_at, ws.organization_id, ws.id::text, ws.id::text, ws.domain, ws.status, null::int, null::text
        from websites ws
        where ${w("ws.created_at")} and ${inScope("ws.organization_id")}
        order by ws.created_at desc limit ${limit}`,
    },
    {
      // The analysis's paid profile extraction (inngest analyze-website), the moment it finished reading the site.
      kinds: ["analysis_done"],
      select: (w, limit) => sql`
        select 'analysis_done', e.created_at, e.organization_id, e.website_id::text, e.id::text, null::text, null::text, null::int, null::text
        from usage_events e
        where ${w("e.created_at")} and e.kind = 'llm' and e.metadata->>'purpose' = 'onboarding_extraction'
          and e.website_id is not null and ${inScope("e.organization_id")}
        order by e.created_at desc limit ${limit}`,
    },
    {
      // Still failed: its last change is the failure.
      kinds: ["analysis_failed"],
      select: (w, limit) => sql`
        select 'analysis_failed', ws.updated_at, ws.organization_id, ws.id::text, ws.id::text, ws.domain, null::text, null::int, null::text
        from websites ws
        where ws.status = 'failed' and ${w("ws.updated_at")} and ${inScope("ws.organization_id")}
        order by ws.updated_at desc limit ${limit}`,
    },
    {
      kinds: ["free_started"],
      select: (w, limit) => sql`
        select 'free_started', f.started_at, f.organization_id, f.website_id::text, f.id::text, f.domain, null::text, null::int, null::text
        from free_plan_accounts f
        where ${w("f.started_at")} and ${inScope("f.organization_id")}
        order by f.started_at desc limit ${limit}`,
    },
    {
      // A trial: trialing now, or bought through a checkout that carried trial days.
      kinds: ["trial_started", "plan_started"],
      select: (w, limit) => sql`
        select case when s.status = 'trialing' or exists (
            select 1 from billing_checkouts c
            where c.trial_days > 0 and c.provider_subscription_id is not null
              and c.provider_subscription_id in (s.stripe_subscription_id, s.paypal_subscription_id)
          ) then 'trial_started' else 'plan_started' end,
          s.created_at, s.organization_id, s.website_id::text, s.id::text, p.name, s.status, null::int, null::text
        from subscriptions s
        left join plans p on p.id = s.plan_id
        where s.plan_id is not null and s.status not in ('incomplete', 'incomplete_expired')
          and ${w("s.created_at")} and ${inScope("s.organization_id")}
        order by s.created_at desc limit ${limit}`,
    },
    {
      kinds: ["plan_changed"],
      select: (w, limit) => sql`
        select 'plan_changed', coalesce(pc.effective_at, pc.updated_at), pc.organization_id, s.website_id::text, pc.id::text,
          p.name, pc.kind, null::int, null::text
        from paypal_plan_changes pc
        left join plans p on p.id = pc.to_plan_id
        left join subscriptions s on s.id = pc.subscription_id
        where pc.status = 'completed' and ${w("coalesce(pc.effective_at, pc.updated_at)")} and ${inScope("pc.organization_id")}
        order by 2 desc limit ${limit}`,
    },
    {
      // Recorded by the lifecycle emails (lib/email/lifecycle-triggers.ts), only while they are switched on.
      kinds: ["plan_cancelled", "trial_ended"],
      select: (w, limit) => sql`
        select case le.kind when 'trial_ended' then 'trial_ended' else 'plan_cancelled' end, le.created_at, le.organization_id,
          s.website_id::text, le.id::text, p.name,
          case when le.dedupe_key like '%:ended' then 'ended' else 'scheduled' end, null::int, null::text
        from lifecycle_emails le
        left join subscriptions s on s.id::text = split_part(le.dedupe_key, ':', 1)
        left join plans p on p.id = s.plan_id
        where le.kind in ('cancellation_confirmed', 'trial_ended') and ${w("le.created_at")} and ${inScope("le.organization_id")}
        order by le.created_at desc limit ${limit}`,
    },
    {
      kinds: ["payment_paid", "payment_failed", "payment_refunded", "payment_no_charge"],
      select: (w, limit) => sql`
        select case
            when p.status = 'failed' then 'payment_failed'
            when p.status = 'refunded' then 'payment_refunded'
            when p.status = 'paid' and p.amount_cents = 0 then 'payment_no_charge'
            when p.status = 'paid' then 'payment_paid'
          end,
          p.paid_at, p.organization_id, s.website_id::text, p.id::text, p.description, p.currency, p.amount_cents, null::text
        from payments p
        left join subscriptions s on s.id = p.subscription_id
        where ${w("p.paid_at")} and ${inScope("p.organization_id")}
        order by p.paid_at desc limit ${limit}`,
    },
    {
      // One research run saves its whole plan at once: items added in the same minute are one event.
      kinds: ["content_plan"],
      select: (w, limit) => sql`
        select 'content_plan', min(ci.created_at), ws.organization_id, ws.id::text,
          ws.id::text || ':' || to_char(date_trunc('minute', ci.created_at), 'YYYYMMDDHH24MI'),
          null::text, null::text, count(*)::int, null::text
        from calendar_items ci
        join websites ws on ws.id = ci.website_id
        where ${w("ci.created_at")} and ${inScope("ws.organization_id")}
        group by ws.organization_id, ws.id, date_trunc('minute', ci.created_at)
        order by 2 desc limit ${limit}`,
    },
    {
      /*
        Every research run reserves its slot (lib/keywords/first-plan.ts
        researchRuns). A run older than an hour with no plan item added in
        the hour after it: failed before spending (released), or ran and
        brought nothing new.
      */
      kinds: ["research_failed", "research_empty"],
      select: (w, limit) => sql`
        select case when r.state = 'released' then 'research_failed' else 'research_empty' end,
          r.created_at, ws.organization_id, ws.id::text, r.id::text, null::text, r.release_reason, null::int, null::text
        from spend_reservations r
        join websites ws on ws.id::text = split_part(r.key, ':', 3)
        where r.key like 'research:site:%' and ${w("r.created_at")}
          and r.created_at < ${iso(new Date(query.now.getTime() - 60 * 60 * 1000))}
          and ${inScope("ws.organization_id")}
          and not exists (
            select 1 from calendar_items ci
            where ci.website_id = ws.id and ci.created_at >= r.created_at and ci.created_at < r.created_at + interval '1 hour'
          )
        order by r.created_at desc limit ${limit}`,
    },
    {
      kinds: ["article_started"],
      select: (w, limit) => sql`
        select 'article_started', a.created_at, ws.organization_id, ws.id::text, a.id::text, a.title, a.status, null::int, a.id::text
        from articles a
        join websites ws on ws.id = a.website_id
        where a.translation_of is null and ${w("a.created_at")} and ${inScope("ws.organization_id")}
        order by a.created_at desc limit ${limit}`,
    },
    {
      // The generator saves the first version with the written body; edits only add later ones.
      kinds: ["article_written"],
      select: (w, limit) => sql`
        select 'article_written', fv.at, ws.organization_id, ws.id::text, fv.article_id::text, a.title, null::text, null::int, a.id::text
        from (select v.article_id, min(v.created_at) as at from article_versions v group by v.article_id) fv
        join articles a on a.id = fv.article_id
        join websites ws on ws.id = a.website_id
        where a.translation_of is null and ${w("fv.at")} and ${inScope("ws.organization_id")}
        order by fv.at desc limit ${limit}`,
    },
    {
      // Still failed: its last change is the failure.
      kinds: ["article_failed"],
      select: (w, limit) => sql`
        select 'article_failed', a.updated_at, ws.organization_id, ws.id::text, a.id::text, a.title, a.error, null::int, a.id::text
        from articles a
        join websites ws on ws.id = a.website_id
        where a.status = 'failed' and a.translation_of is null and ${w("a.updated_at")} and ${inScope("ws.organization_id")}
        order by a.updated_at desc limit ${limit}`,
    },
    {
      // "published" = delivered to the CMS; remote_status says whether it went live.
      kinds: ["article_delivered", "delivery_failed"],
      select: (w, limit) => sql`
        select case pl.status when 'published' then 'article_delivered' when 'failed' then 'delivery_failed' end,
          pl.created_at, ws.organization_id, ws.id::text, pl.id::text, a.title,
          case pl.status when 'published' then pl.remote_status else pl.error end, null::int, a.id::text
        from publish_logs pl
        join articles a on a.id = pl.article_id
        join websites ws on ws.id = a.website_id
        where pl.status in ('published', 'failed') and ${w("pl.created_at")} and ${inScope("ws.organization_id")}
        order by pl.created_at desc limit ${limit}`,
    },
    {
      kinds: ["social_posted"],
      select: (w, limit) => sql`
        select 'social_posted', ss.posted_at, ws.organization_id, ws.id::text, ss.id::text, ss.platform, null::text, null::int, null::text
        from social_suggestions ss
        join websites ws on ws.id = ss.website_id
        where ss.posted_at is not null and ${w("ss.posted_at")} and ${inScope("ws.organization_id")}
        order by ss.posted_at desc limit ${limit}`,
    },
    {
      kinds: ["video_approved"],
      select: (w, limit) => sql`
        select 'video_approved', vi.approved_at, ws.organization_id, ws.id::text, vi.id::text, vi.title, null::text, null::int, null::text
        from video_ideas vi
        join websites ws on ws.id = vi.website_id
        where vi.approved_at is not null and ${w("vi.approved_at")} and ${inScope("ws.organization_id")}
        order by vi.approved_at desc limit ${limit}`,
    },
    {
      kinds: ["video_posted"],
      select: (w, limit) => sql`
        select 'video_posted', vi.posted_at, ws.organization_id, ws.id::text, vi.id::text, vi.title, null::text, null::int, null::text
        from video_ideas vi
        join websites ws on ws.id = vi.website_id
        where vi.posted_at is not null and ${w("vi.posted_at")} and ${inScope("ws.organization_id")}
        order by vi.posted_at desc limit ${limit}`,
    },
    {
      // From a signed-in customer: their workspace, or the first one they belong to.
      kinds: ["feedback_sent"],
      select: (w, limit) => sql`
        select 'feedback_sent', f.created_at, fo.org_id, null::text, f.id::text, f.message, f.kind, null::int, null::text
        from feedback f
        left join lateral (
          select coalesce(f.organization_id,
            (select m.organization_id from member m where m.user_id = f.user_id order by m.created_at limit 1)) as org_id
        ) fo on true
        where ${w("f.created_at")} and ${inScope("fo.org_id")}
        order by f.created_at desc limit ${limit}`,
    },
  ];
}

function scopeCte(scope: string[] | null): SQL {
  return scope === null
    ? sql`scope as (select id from organization)`
    : sql`scope as (select jsonb_array_elements_text(${JSON.stringify(scope)}::jsonb) as id)`;
}

/** The raw events, newest first, at most `limit`. One query. */
export async function activityEvents(query: EventQuery): Promise<RawActivity[]> {
  const wanted = new Set(query.kinds);
  if (wanted.size === 0 || (query.scope !== null && query.scope.length === 0 && !query.orphans)) return [];
  const window = (column: string) => {
    const parts: SQL[] = [sql`${sql.raw(column)} is not null`];
    if (query.since) parts.push(sql`${sql.raw(column)} >= ${iso(query.since)}`);
    if (query.before) parts.push(sql`${sql.raw(column)} < ${iso(query.before)}`);
    return sql.join(parts, sql` and `);
  };
  const selected = branches(query).filter((branch) => branch.kinds.some((kind) => wanted.has(kind)));
  const union = sql.join(
    selected.map((branch) => sql`(${branch.select(window, query.limit)})`),
    sql` union all `,
  );
  const rows = rowsOf(
    await db.execute(sql`
      with ${scopeCte(query.scope)}
      select e.kind, to_char(e.at, ${ISO}) as at_iso, e.org_id, e.website_id, e.ref_id, e.label, e.extra, e.amount, e.article_id
      from (${union}) e(${COLUMNS})
      where e.kind in (${sql.join([...wanted].map((kind) => sql`${kind}`), sql`, `)})
      order by e.at desc, e.ref_id
      limit ${query.limit}
    `),
  );
  return rows.flatMap((row) => {
    const at = dateOf(row.at_iso);
    if (!isActivityKind(row.kind) || !at) return [];
    return [
      {
        kind: row.kind,
        at,
        organizationId: text(row.org_id),
        websiteId: text(row.website_id),
        refId: String(row.ref_id),
        label: text(row.label),
        extra: text(row.extra),
        amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
        articleId: text(row.article_id),
      },
    ];
  });
}

/** Domains of the websites the rows name, in one query. */
async function domainsOf(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: websites.id, domain: websites.domain }).from(websites).where(inArray(websites.id, unique));
  return new Map(rows.map((row) => [row.id, row.domain]));
}

/* ------------------------------------------------------------------------- */
/* Needs attention                                                            */
/* ------------------------------------------------------------------------- */

/** Every rule's candidates in five bounded queries, then the rules. */
export async function attentionItems(scope: string[] | null, now: Date): Promise<AttentionItem[]> {
  if (scope !== null && scope.length === 0) return [];
  const cte = scopeCte(scope);
  const hoursAgo = (hours: number) => iso(new Date(now.getTime() - hours * 60 * 60 * 1000));

  const [trials, failedSites, noPlan, failedArticles, failedPayments] = await Promise.all([
    db.execute(sql`
      with ${cte}
      select s.id, s.organization_id, s.website_id::text as website_id, s.status,
        to_char(s.created_at, ${ISO}) as started_at, to_char(s.current_period_end, ${ISO}) as ends_at,
        (select to_char(min(a.created_at), ${ISO}) from articles a
          where a.website_id = s.website_id and a.translation_of is null) as first_article_at,
        exists (select 1 from articles a
          where a.website_id = s.website_id and a.translation_of is null and a.body_html is not null) as written
      from subscriptions s
      where s.status = 'trialing' and s.website_id is not null and ${inScope("s.organization_id")}
      order by s.created_at desc limit 200
    `),
    db.execute(sql`
      with ${cte}
      select ws.id::text as id, ws.organization_id, ws.domain, ws.status, to_char(ws.updated_at, ${ISO}) as updated_at
      from websites ws
      where ws.status = 'failed' and ws.updated_at >= ${hoursAgo(30 * 24)} and ${inScope("ws.organization_id")}
      order by ws.updated_at desc limit ${ATTENTION_LIMIT}
    `),
    db.execute(sql`
      with ${cte}
      select ws.id::text as id, ws.organization_id, ws.domain, to_char(ws.created_at, ${ISO}) as created_at,
        (select to_char(max(e.created_at), ${ISO}) from usage_events e
          where e.organization_id = ws.organization_id and e.website_id = ws.id and e.kind = 'llm'
            and e.metadata->>'purpose' = 'onboarding_extraction') as analysed_at,
        (select to_char(min(t.at), ${ISO}) from (
          select s.created_at as at from subscriptions s
          where s.website_id = ws.id and s.status in ('active', 'trialing', 'past_due')
          union all
          select f.started_at from free_plan_accounts f where f.website_id = ws.id
        ) t) as entitled_at
      from websites ws
      where ws.status in ('ready', 'researching') and ${inScope("ws.organization_id")}
        and not exists (select 1 from calendar_items ci where ci.website_id = ws.id)
        and not exists (select 1 from articles a where a.website_id = ws.id)
        and (
          exists (select 1 from subscriptions s where s.website_id = ws.id and s.status in ('active', 'trialing', 'past_due'))
          or exists (select 1 from free_plan_accounts f where f.website_id = ws.id)
        )
      order by ws.created_at desc limit ${NO_PLAN_CANDIDATES}
    `),
    db.execute(sql`
      with ${cte}
      select a.id::text as id, ws.organization_id, ws.id::text as website_id, a.title, a.status, a.error,
        to_char(a.updated_at, ${ISO}) as failed_at,
        exists (
          select 1 from articles b
          where b.website_id = a.website_id and b.id <> a.id and b.body_html is not null and b.created_at > a.created_at
            and ((a.calendar_item_id is not null and b.calendar_item_id = a.calendar_item_id)
              or (a.calendar_item_id is null and b.title = a.title))
        ) as retried_ok
      from articles a
      join websites ws on ws.id = a.website_id
      where a.status = 'failed' and a.translation_of is null and a.updated_at >= ${hoursAgo(48)} and ${inScope("ws.organization_id")}
      order by a.updated_at desc limit ${ATTENTION_LIMIT}
    `),
    db.execute(sql`
      with ${cte}
      select p.id::text as id, p.organization_id, s.website_id::text as website_id, p.status, p.amount_cents, p.currency,
        p.description, to_char(p.paid_at, ${ISO}) as paid_at
      from payments p
      left join subscriptions s on s.id = p.subscription_id
      where p.status = 'failed' and p.paid_at >= ${hoursAgo(7 * 24)} and ${inScope("p.organization_id")}
      order by p.paid_at desc limit ${ATTENTION_LIMIT}
    `),
  ]);

  const items: AttentionItem[] = [];

  for (const row of rowsOf(trials)) {
    const trial: TrialFacts = {
      subscriptionId: String(row.id),
      organizationId: String(row.organization_id),
      websiteId: String(row.website_id),
      status: String(row.status),
      startedAt: dateOf(row.started_at) ?? now,
      endsAt: dateOf(row.ends_at),
      firstArticleStartedAt: dateOf(row.first_article_at),
      articleWritten: Boolean(row.written),
    };
    for (const item of [trialNoArticle(trial, now), trialEndingNoArticle(trial, now)]) if (item) items.push(item);
  }

  for (const row of rowsOf(failedSites)) {
    const item = analysisFailed(
      {
        websiteId: String(row.id),
        organizationId: String(row.organization_id),
        domain: String(row.domain),
        status: String(row.status),
        updatedAt: dateOf(row.updated_at) ?? now,
      },
      now,
    );
    if (item) items.push(item);
  }

  const planCandidates: NoPlanFacts[] = rowsOf(noPlan).map((row) => ({
    websiteId: String(row.id),
    organizationId: String(row.organization_id),
    domain: String(row.domain),
    readyAt: dateOf(row.analysed_at) ?? dateOf(row.created_at) ?? now,
    entitledAt: dateOf(row.entitled_at) ?? dateOf(row.created_at) ?? now,
    hasContentPlan: false,
    status: null,
  }));
  const due = planCandidates.filter((site) => noPlanDue(site, now)).slice(0, NO_PLAN_CHECKS);
  const statuses = await Promise.all(due.map((site) => firstArticleStatus(site.websiteId, now).catch(() => null)));
  due.forEach((site, index) => {
    const status = statuses[index];
    const item = noContentPlan({ ...site, status: status ? { code: status.code, message: status.message } : null }, now);
    if (item) items.push(item);
  });

  for (const row of rowsOf(failedArticles)) {
    const item = articleFailed(
      {
        articleId: String(row.id),
        organizationId: String(row.organization_id),
        websiteId: String(row.website_id),
        title: String(row.title ?? ""),
        status: String(row.status),
        error: text(row.error),
        failedAt: dateOf(row.failed_at) ?? now,
        retriedOk: Boolean(row.retried_ok),
      },
      now,
    );
    if (item) items.push(item);
  }

  for (const row of rowsOf(failedPayments)) {
    const item = paymentFailed(
      {
        paymentId: String(row.id),
        organizationId: String(row.organization_id),
        websiteId: text(row.website_id),
        status: String(row.status),
        amountCents: Number(row.amount_cents ?? 0),
        currency: String(row.currency ?? "eur"),
        description: text(row.description),
        paidAt: dateOf(row.paid_at) ?? now,
      },
      now,
    );
    if (item) items.push(item);
  }

  return sortAttention(items);
}

/* ------------------------------------------------------------------------- */
/* What the page reads                                                        */
/* ------------------------------------------------------------------------- */

export type ActivityCustomer = {
  organizationId: string | null;
  name: string | null;
  ownerEmail: string | null;
  badge: PlanBadge | null;
};

export type ActivityRow = ActivityEvent & { customer: ActivityCustomer; domain: string | null };
export type AttentionRow = AttentionItem & { customer: ActivityCustomer; domain: string | null };

function customerOf(facts: Map<string, WorkspaceFacts>, organizationId: string | null, fallbackEmail: string | null = null): ActivityCustomer {
  const workspace = organizationId ? facts.get(organizationId) : undefined;
  if (!workspace) return { organizationId, name: null, ownerEmail: fallbackEmail, badge: null };
  return { organizationId, name: workspace.name, ownerEmail: workspace.ownerEmail, badge: planBadge(workspace) };
}

export const RANGES = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
export type ActivityRange = keyof typeof RANGES;
export const isRange = (value: unknown): value is ActivityRange => typeof value === "string" && Object.hasOwn(RANGES, value);

export type CustomerActivity = {
  now: Date;
  since: Date;
  before: Date | null;
  rows: ActivityRow[];
  /** The feed hit FEED_LIMIT: older rows in the range exist beyond the last one shown. */
  truncated: boolean;
  attention: AttentionRow[];
  /** Workspaces hidden as ours (when not included). */
  hiddenOurs: number;
};

export async function getCustomerActivity(options: {
  group?: string;
  filters: ActivityFilters;
  range?: string;
  before?: Date | null;
  now?: Date;
}): Promise<CustomerActivity> {
  await requireAdmin();
  const now = options.now ?? new Date();
  const range = isRange(options.range) ? options.range : "7d";
  const end = options.before && options.before < now ? options.before : now;
  const since = new Date(end.getTime() - RANGES[range] * 60 * 60 * 1000);

  const all = await workspaceFacts();
  const admins = adminEmails();
  const internal = internalWebsiteIds();
  const byId = new Map(all.map((facts) => [facts.id, facts]));
  let hiddenOurs = 0;
  const kept = all.filter((facts) => {
    const ours = isOurWorkspace(facts, admins, internal);
    if (ours && !options.filters.includeOurs) hiddenOurs += 1;
    return workspaceInScope(facts, options.filters, ours);
  });
  const scope = kept.length === all.length && all.length < WORKSPACE_LIMIT ? null : kept.map((facts) => facts.id);
  const anyPlan = !["free", "trial", "paid"].includes(options.filters.plan);

  const [raw, attention] = await Promise.all([
    activityEvents({
      kinds: kindsForGroup(options.group),
      scope,
      since,
      before: options.before ? end : null,
      now,
      limit: FEED_LIMIT,
      orphans: anyPlan ? { search: options.filters.search.trim(), hideEmails: options.filters.includeOurs ? [] : admins } : null,
    }),
    // The box reads the present, so it ignores "Load older" and the type filter.
    options.before ? Promise.resolve([]) : attentionItems(scope, now),
  ]);

  const domains = await domainsOf([...raw.map((row) => row.websiteId), ...attention.map((item) => item.websiteId)]);
  const rows = raw.map((event) => {
    const domain = event.websiteId ? (domains.get(event.websiteId) ?? null) : null;
    const signupEmail = event.kind === "signup" ? event.label : null;
    return { ...describeActivity(event, domain), customer: customerOf(byId, event.organizationId, signupEmail), domain };
  });
  return {
    now,
    since,
    before: options.before ? end : null,
    rows,
    truncated: raw.length >= FEED_LIMIT,
    attention: attention.map((item) => ({
      ...item,
      customer: customerOf(byId, item.organizationId),
      domain: item.websiteId ? (domains.get(item.websiteId) ?? null) : null,
    })),
    hiddenOurs,
  };
}

export type TimelineWebsite = {
  id: string;
  domain: string;
  status: string;
  createdAt: Date;
  firstArticle: FirstArticleStatus | null;
};

export type TimelineSubscription = {
  id: string;
  websiteId: string | null;
  planName: string | null;
  status: string;
  trial: boolean;
  createdAt: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
};

export type CustomerTimeline = {
  now: Date;
  workspace: WorkspaceFacts;
  badge: PlanBadge;
  ours: boolean;
  websites: TimelineWebsite[];
  subscriptions: TimelineSubscription[];
  freeStartedAt: Date | null;
  /** UTC days with articles, newest first: started, and of those written. */
  articlesPerDay: { day: string; started: number; written: number }[];
  rows: ActivityRow[];
  truncated: boolean;
  attention: AttentionRow[];
};

/** One workspace over its whole life (bounded by TIMELINE_LIMIT), or null when it does not exist. */
export async function getCustomerTimeline(organizationId: string, now: Date = new Date()): Promise<CustomerTimeline | null> {
  await requireAdmin();
  const [workspace] = await workspaceFacts(organizationId);
  if (!workspace) return null;
  const scope = [workspace.id];

  const [raw, attention, siteRows, subRows, freeRows, dayRows] = await Promise.all([
    activityEvents({ kinds: kindsForGroup(null), scope, since: null, before: null, now, limit: TIMELINE_LIMIT, orphans: null }),
    attentionItems(scope, now),
    db.execute(sql`
      select ws.id::text as id, ws.domain, ws.status, to_char(ws.created_at, ${ISO}) as created_at
      from websites ws where ws.organization_id = ${workspace.id}
      order by ws.created_at limit ${TIMELINE_WEBSITES}
    `),
    db.execute(sql`
      select s.id::text as id, s.website_id::text as website_id, p.name as plan_name, s.status,
        (s.status = 'trialing' or exists (
          select 1 from billing_checkouts c
          where c.trial_days > 0 and c.provider_subscription_id is not null
            and c.provider_subscription_id in (s.stripe_subscription_id, s.paypal_subscription_id)
        )) as trial,
        to_char(s.created_at, ${ISO}) as created_at, to_char(s.current_period_start, ${ISO}) as period_start,
        to_char(s.current_period_end, ${ISO}) as period_end, s.cancel_at_period_end, to_char(s.cancel_at, ${ISO}) as cancel_at
      from subscriptions s
      left join plans p on p.id = s.plan_id
      where s.organization_id = ${workspace.id}
      order by s.created_at desc limit 50
    `),
    db.execute(sql`select to_char(f.started_at, ${ISO}) as started_at from free_plan_accounts f where f.organization_id = ${workspace.id} limit 1`),
    db.execute(sql`
      select to_char(date_trunc('day', a.created_at), 'YYYY-MM-DD') as day, count(*)::int as started,
        (count(*) filter (where a.body_html is not null))::int as written
      from articles a
      join websites ws on ws.id = a.website_id
      where ws.organization_id = ${workspace.id} and a.translation_of is null
      group by 1 order by 1 desc limit 60
    `),
  ]);

  const sites = rowsOf(siteRows).map((row) => ({
    id: String(row.id),
    domain: String(row.domain),
    status: String(row.status),
    createdAt: dateOf(row.created_at) ?? now,
  }));
  const statuses = await Promise.all(sites.map((site) => firstArticleStatus(site.id, now).catch(() => null)));

  const byId = new Map([[workspace.id, workspace]]);
  const domains = await domainsOf([...raw.map((row) => row.websiteId), ...attention.map((item) => item.websiteId)]);
  return {
    now,
    workspace,
    badge: planBadge(workspace),
    ours: isOurWorkspace(workspace, adminEmails(), internalWebsiteIds()),
    websites: sites.map((site, index) => ({ ...site, firstArticle: statuses[index] })),
    subscriptions: rowsOf(subRows).map((row) => ({
      id: String(row.id),
      websiteId: text(row.website_id),
      planName: text(row.plan_name),
      status: String(row.status),
      trial: Boolean(row.trial),
      createdAt: dateOf(row.created_at) ?? now,
      periodStart: dateOf(row.period_start),
      periodEnd: dateOf(row.period_end),
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      cancelAt: dateOf(row.cancel_at),
    })),
    freeStartedAt: dateOf(rowsOf(freeRows)[0]?.started_at),
    articlesPerDay: rowsOf(dayRows).map((row) => ({ day: String(row.day), started: Number(row.started), written: Number(row.written) })),
    rows: raw.map((event) => {
      const domain = event.websiteId ? (domains.get(event.websiteId) ?? null) : null;
      return { ...describeActivity(event, domain), customer: customerOf(byId, event.organizationId), domain };
    }),
    truncated: raw.length >= TIMELINE_LIMIT,
    attention: attention.map((item) => ({
      ...item,
      customer: customerOf(byId, item.organizationId),
      domain: item.websiteId ? (domains.get(item.websiteId) ?? null) : null,
    })),
  };
}
