import "server-only";

import { sql } from "drizzle-orm";

import { ensureMonthlyCredits } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";

import { readDailyStatus, utcDay, type DailyCredits } from "./daily";
import { readCreditSettings, type CreditAction, type CreditSettings } from "./prices";
import { walletOf } from "./spend";

/**
 * What the Credits page and the sidebar show: one workspace's credits, and
 * what they buy. Callers authorize first (the workspace is the viewer's own).
 */

export type CreditOverview = {
  balance: number;
  /** Held for backlinks being placed. */
  reserved: number;
  /** The balance less what backlinks hold: what can be spent now. */
  available: number;
  daily: DailyCredits;
  settings: CreditSettings;
};

/**
 * Reading the overview grants this month's plan credits (lazily, keyed so they
 * are granted once), because every signed-in page shows it in the sidebar. It
 * only REPORTS the daily credits: those take the customer's own check-in
 * (claimDailyCredits in lib/credits/daily.ts), so no page load ever gives them.
 */
export async function creditOverview(organizationId: string, now: Date = new Date()): Promise<CreditOverview> {
  await ensureMonthlyCredits(organizationId);
  const [daily, settings, wallet] = await Promise.all([
    readDailyStatus(organizationId, now),
    readCreditSettings(),
    walletOf(db, organizationId),
  ]);
  return { ...wallet, daily, settings };
}

export type CreditHistoryRow = {
  id: string;
  at: Date;
  /** A ledger type (lib/backlinks/credits.ts CreditType). */
  type: string;
  /** Signed. */
  amount: number;
  note: string | null;
  /** For a spend or its refund: what it paid for (a CreditAction, or "addon:<slug>"). */
  action: CreditAction | string | null;
  /** For a spend on a service: its name. */
  addonName: string | null;
  /** The workspace website an entry concerns; null for workspace-wide entries. */
  websiteDomain: string | null;
};

const MAX_PAGE_SIZE = 50;

function rowsOf(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Record<string, unknown>[];
}

/**
 * The history's filter (client design, 2026-11-02: "All / Earned / Spent").
 * "spent" is every credit paid out AND what came back from a payment - a
 * spend's refund, a removed link's refund - so a video that could not be made
 * shows beside its charge rather than as credits earned. "earned" is every
 * other credit that came in. Together they are every row.
 */
export const CREDIT_KINDS = ["all", "earned", "spent"] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

export function creditKindOf(value: unknown): CreditKind {
  return typeof value === "string" && (CREDIT_KINDS as readonly string[]).includes(value) ? (value as CreditKind) : "all";
}

/** A ledger row (aliased `cl`) that is spending, as above. */
const SPENT = sql`(cl.amount < 0 or cl.type in ('spend_refund', 'refund'))`;

function kindFilter(kind: CreditKind) {
  return kind === "earned" ? sql`not ${SPENT}` : kind === "spent" ? SPENT : sql`true`;
}

/**
 * What came in and went out today, for the Credits page's balance: credits
 * earned (the "earned" rows) and credits used (the "spent" rows, net of
 * their refunds; never below 0, so a refund today of yesterday's spend reads
 * as nothing used rather than as a negative). "Today" is the UTC day, the
 * day daily credits are claimed on (lib/credits/daily.ts); created_at is
 * stored in UTC, as creditHistory reads it.
 *
 * Read it after creditOverview, which is what grants this month's plan credits.
 */
export async function creditToday(
  organizationId: string,
  now: Date = new Date(),
): Promise<{ earned: number; used: number }> {
  const day = utcDay(now);
  const [row] = rowsOf(
    await db.execute(sql`
      select
        coalesce(sum(cl.amount) filter (where not ${SPENT}), 0)::int as earned,
        coalesce(-sum(cl.amount) filter (where ${SPENT}), 0)::int as used
      from credit_ledger cl
      where cl.organization_id = ${organizationId} and cl.amount <> 0
        and cl.created_at >= ${day}::timestamp and cl.created_at < ${day}::timestamp + interval '1 day'
    `),
  );
  return { earned: Number(row?.earned ?? 0), used: Math.max(0, Number(row?.used ?? 0)) };
}

/**
 * The workspace's credit history, newest first, paginated in the database:
 * every ledger movement, or only the earned or spent ones (`kind`). Zero
 * rows - "this month's plan credits are settled" markers - are left out, as
 * everywhere.
 */
export async function creditHistory(
  organizationId: string,
  options: { page: number; pageSize: number; kind?: CreditKind },
): Promise<{ rows: CreditHistoryRow[]; total: number; page: number; pageCount: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(options.pageSize, 10), MAX_PAGE_SIZE);
  const kind = kindFilter(options.kind ?? "all");
  const [counted] = rowsOf(
    await db.execute(sql`
      select count(*)::int as n from credit_ledger cl
      where cl.organization_id = ${organizationId} and cl.amount <> 0 and ${kind}
    `),
  );
  const total = Number(counted?.n ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number.isFinite(options.page) ? options.page : 1, 1), pageCount);

  const result = await db.execute(sql`
    select cl.id::text as id, to_char(cl.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at, cl.type, cl.amount, cl.note,
      cs.action, a.name as addon_name,
      coalesce(sw.domain, (
        select case
          when cl.type = 'link_given' or cl.idempotency_key like 'placement:%:host_reversal' then h.domain
          else b.domain end
        from placements p
        join backlink_requests r on r.id = p.request_id
        join websites b on b.id = r.website_id
        left join websites h on h.id = p.host_website_id
        where p.id::text = cl.reference_id
          and (b.organization_id = ${organizationId} or h.organization_id = ${organizationId})
        limit 1
      )) as website_domain
    from credit_ledger cl
    left join credit_spends cs on cl.type in ('spend', 'spend_refund') and cs.id::text = cl.reference_id
    left join websites sw on sw.id = cs.website_id and sw.organization_id = ${organizationId}
    left join addons a on cs.action = 'addon:' || a.slug
    where cl.organization_id = ${organizationId} and cl.amount <> 0 and ${kind}
    order by cl.created_at desc, cl.id desc
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);
  return {
    rows: rowsOf(result).map((row) => ({
      id: row.id as string,
      at: new Date(row.at as string),
      type: row.type as string,
      amount: Number(row.amount),
      note: (row.note as string | null) ?? null,
      action: (row.action as string | null) ?? null,
      addonName: (row.addon_name as string | null) ?? null,
      websiteDomain: (row.website_domain as string | null) ?? null,
    })),
    total,
    page,
    pageCount,
    pageSize,
  };
}
