import "server-only";

import { sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { onboardingWelcomeOn, WELCOME_WINDOW_DAYS } from "@/lib/support/onboarding-welcome";

/**
 * Admin -> Onboarding help: the spec's "Track when the welcome message is
 * triggered, opened, dismissed and answered, together with whether the user
 * completes onboarding" (ticket 2026-11-19, item 6, "RepGet - Proactive
 * Human Support During Onboarding").
 *
 * READ ONLY, from what the welcome already records: support_chat_state
 * (lib/support/onboarding-welcome.ts) for the welcome and the chat events,
 * the account and its workspace for who they are, and the subscriptions /
 * Free plan rows for their plan. No AI call, nothing written.
 *
 * THE FUNNEL is the accounts that signed up in the last WINDOW_DAYS days:
 *
 *  - eligible: an ESTIMATE, because eligibility is decided live and never
 *    stored - the account owns a workspace that paid nothing in its first
 *    WELCOME_WINDOW_DAYS days, or it was welcomed (a welcome is proof it
 *    was eligible). It cannot know who had already finished setup or written
 *    to support before the 60 seconds were up, so it is an upper bound.
 *  - welcomed: the claim that pushed the Crisp event (welcomed_at);
 *  - opened / dismissed / answered: the first chat:opened, chat:closed with
 *    nothing sent, and message:sent after the welcome (the closest signals
 *    Crisp gives; it has no callback for the notification itself);
 *  - onboarding completed: noted once, for a welcomed account, when the
 *    required setup steps are all done.
 *
 * Rates are of the welcomed accounts (welcomed: of the eligible ones).
 * THE DAILY TREND counts each event on the UTC day it happened.
 */

export const WINDOW_DAYS = 30;
const RECENT_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export type OnboardingHelpTotals = {
  eligible: number;
  welcomed: number;
  opened: number;
  dismissed: number;
  answered: number;
  completed: number;
  /** Not welcomed because a conversation already existed: in the app, or found in Crisp (lib/support/crisp-conversations.ts). */
  conversationFirst: number;
  /** Of those, found through Crisp's API (a first message we never saw: last_message_at is still empty). */
  foundInCrisp: number;
};

export type OnboardingHelpDay = {
  day: string;
  signups: number;
  welcomed: number;
  opened: number;
  dismissed: number;
  answered: number;
  completed: number;
};

export type OnboardingHelpRow = {
  userId: string;
  name: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  /** "Grow · trialing", "Free", "No plan"... */
  plan: string;
  signedUpAt: Date | null;
  welcomedAt: Date | null;
  openedAt: Date | null;
  dismissedAt: Date | null;
  answeredAt: Date | null;
  completedAt: Date | null;
  firstMessageAt: Date | null;
  /** The conversation was found in Crisp, not in the app (see foundInCrisp). */
  foundInCrisp: boolean;
  supportRequests: number;
};

export type OnboardingHelp = {
  switchOn: boolean;
  /** NEXT_PUBLIC_CRISP_WEBSITE_ID is set: without it the switch does nothing. */
  crispConfigured: boolean;
  /** CRISP_API_IDENTIFIER and CRISP_API_KEY: the existing-conversation check through Crisp's API. */
  crispApiConfigured: boolean;
  since: Date;
  totals: OnboardingHelpTotals;
  /** Oldest first, WINDOW_DAYS UTC days ending today. */
  perDay: OnboardingHelpDay[];
  /** The latest welcomes and conversations, newest first. */
  recent: OnboardingHelpRow[];
};

type Row = Record<string, unknown>;
const rowsOf = (result: unknown) => (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Row[];
const date = (value: unknown) => (value ? new Date(value as string) : null);
const n = (value: unknown) => Number(value ?? 0);
const iso = (value: Date) => sql`${value.toISOString()}::timestamp`;

/** The first of the WINDOW_DAYS UTC days that end today. */
export function windowStart(now: Date): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (WINDOW_DAYS - 1) * DAY_MS);
}

/** A rate as the page shows it; "—" with nothing to divide by. */
export function rate(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/** One plan label from the workspace's best subscription and its Free row. */
export function planLabel(subscription: { name: string | null; status: string | null } | null, onFree: boolean): string {
  if (subscription?.status && ["active", "trialing", "past_due"].includes(subscription.status)) {
    const name = subscription.name ?? "Paid plan";
    return subscription.status === "active" ? name : `${name} · ${subscription.status === "trialing" ? "trial" : "past due"}`;
  }
  if (onFree) return "Free";
  if (subscription?.status) return `${subscription.name ?? "Plan"} · ${subscription.status}`;
  return "No plan";
}

export async function getOnboardingHelp(now: Date = new Date()): Promise<OnboardingHelp> {
  await requireAdmin();
  const since = windowStart(now);
  const welcomeWindow = sql`${WELCOME_WINDOW_DAYS}::int * interval '1 day'`;

  // The funnel: accounts that signed up in the window.
  const [totalsRow] = rowsOf(
    await db.execute(sql`
      with cohort as (
        select u.id,
          s.welcomed_at, s.welcome_opened_at, s.welcome_dismissed_at, s.welcome_answered_at,
          s.onboarding_completed_at, s.first_message_at, s.last_message_at,
          exists (
            select 1 from member m
            where m.user_id = u.id and m.role = 'owner'
              and not exists (
                select 1 from payments p
                where p.organization_id = m.organization_id and p.status in ('paid', 'refunded') and p.amount_cents > 0
                  and p.paid_at < u.created_at + ${welcomeWindow}
              )
          ) as unpaid_owner
        from "user" u
        left join support_chat_state s on s.user_id = u.id
        where u.created_at >= ${iso(since)}
      )
      select
        count(*) filter (where unpaid_owner or welcomed_at is not null)::int as eligible,
        count(*) filter (where welcomed_at is not null)::int as welcomed,
        count(*) filter (where welcomed_at is not null and welcome_opened_at is not null)::int as opened,
        count(*) filter (where welcomed_at is not null and welcome_dismissed_at is not null)::int as dismissed,
        count(*) filter (where welcomed_at is not null and welcome_answered_at is not null)::int as answered,
        count(*) filter (where welcomed_at is not null and onboarding_completed_at is not null)::int as completed,
        count(*) filter (where welcomed_at is null and first_message_at is not null)::int as conversation_first,
        count(*) filter (where welcomed_at is null and first_message_at is not null and last_message_at is null)::int as found_in_crisp
      from cohort
    `),
  );
  const totals: OnboardingHelpTotals = {
    eligible: n(totalsRow?.eligible),
    welcomed: n(totalsRow?.welcomed),
    opened: n(totalsRow?.opened),
    dismissed: n(totalsRow?.dismissed),
    answered: n(totalsRow?.answered),
    completed: n(totalsRow?.completed),
    conversationFirst: n(totalsRow?.conversation_first),
    foundInCrisp: n(totalsRow?.found_in_crisp),
  };

  // Each event on its own UTC day.
  const dayRows = rowsOf(
    await db.execute(sql`
      select to_char(date_trunc('day', at), 'YYYY-MM-DD') as day, what, count(*)::int as n
      from (
        select created_at as at, 'signups' as what from "user" where created_at >= ${iso(since)}
        union all select welcomed_at, 'welcomed' from support_chat_state where welcomed_at >= ${iso(since)}
        union all select welcome_opened_at, 'opened' from support_chat_state where welcome_opened_at >= ${iso(since)}
        union all select welcome_dismissed_at, 'dismissed' from support_chat_state where welcome_dismissed_at >= ${iso(since)}
        union all select welcome_answered_at, 'answered' from support_chat_state where welcome_answered_at >= ${iso(since)}
        union all select onboarding_completed_at, 'completed' from support_chat_state where onboarding_completed_at >= ${iso(since)}
      ) events
      group by 1, 2
    `),
  );
  const perDay: OnboardingHelpDay[] = Array.from({ length: WINDOW_DAYS }, (_, index) => ({
    day: new Date(since.getTime() + index * DAY_MS).toISOString().slice(0, 10),
    signups: 0,
    welcomed: 0,
    opened: 0,
    dismissed: 0,
    answered: 0,
    completed: 0,
  }));
  const byDay = new Map(perDay.map((entry) => [entry.day, entry]));
  for (const row of dayRows) {
    const entry = byDay.get(row.day as string);
    const what = row.what as keyof Omit<OnboardingHelpDay, "day">;
    if (entry && what in entry) entry[what] = n(row.n);
  }

  const recentRows = rowsOf(
    await db.execute(sql`
      select s.user_id, u.name, u.email, u.created_at as signed_up_at,
        s.organization_id, o.name as organization_name,
        s.welcomed_at, s.welcome_opened_at, s.welcome_dismissed_at, s.welcome_answered_at,
        s.onboarding_completed_at, s.first_message_at, s.last_message_at, s.support_requests,
        sub.name as plan_name, sub.status as plan_status,
        exists (select 1 from free_plan_accounts f where f.organization_id = s.organization_id) as on_free
      from support_chat_state s
      left join "user" u on u.id = s.user_id
      left join organization o on o.id = s.organization_id
      left join lateral (
        select pl.name, x.status from subscriptions x
        left join plans pl on pl.id = x.plan_id
        where x.organization_id = s.organization_id and x.plan_id is not null
        order by case x.status when 'active' then 0 when 'trialing' then 1 when 'past_due' then 2 else 3 end, x.created_at desc
        limit 1
      ) sub on true
      where s.welcomed_at is not null or s.first_message_at is not null
      order by coalesce(s.welcomed_at, s.first_message_at) desc
      limit ${RECENT_LIMIT}
    `),
  );
  const recent: OnboardingHelpRow[] = recentRows.map((row) => ({
    userId: row.user_id as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    organizationId: (row.organization_id as string | null) ?? null,
    organizationName: (row.organization_name as string | null) ?? null,
    plan: planLabel(
      row.plan_status ? { name: (row.plan_name as string | null) ?? null, status: row.plan_status as string } : null,
      Boolean(row.on_free),
    ),
    signedUpAt: date(row.signed_up_at),
    welcomedAt: date(row.welcomed_at),
    openedAt: date(row.welcome_opened_at),
    dismissedAt: date(row.welcome_dismissed_at),
    answeredAt: date(row.welcome_answered_at),
    completedAt: date(row.onboarding_completed_at),
    firstMessageAt: date(row.first_message_at),
    foundInCrisp: !row.welcomed_at && Boolean(row.first_message_at) && !row.last_message_at,
    supportRequests: n(row.support_requests),
  }));

  return {
    switchOn: onboardingWelcomeOn(),
    crispConfigured: Boolean(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim()),
    crispApiConfigured: Boolean(process.env.CRISP_API_IDENTIFIER?.trim() && process.env.CRISP_API_KEY?.trim()),
    since,
    totals,
    perDay,
    recent,
  };
}
