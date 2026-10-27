import "server-only";

import { sql } from "drizzle-orm";

import { ensureMonthlyCredits } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";

import { ensureDailyCredits, type DailyCredits } from "./daily";
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
 * Reading the overview is what grants this month's plan credits and today's
 * daily credits (both lazily, both keyed so they are granted once): every
 * signed-in page shows it in the sidebar, so "the customer opened RepGet
 * today" is exactly "an overview was read today".
 */
export async function creditOverview(organizationId: string, now: Date = new Date()): Promise<CreditOverview> {
  await ensureMonthlyCredits(organizationId);
  const daily = await ensureDailyCredits(organizationId, now);
  const [settings, wallet] = await Promise.all([readCreditSettings(), walletOf(db, organizationId)]);
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
 * The workspace's credit history, newest first, paginated in the database:
 * every ledger movement. Zero rows - "this month's plan credits are settled"
 * markers - are left out, as everywhere.
 */
export async function creditHistory(
  organizationId: string,
  options: { page: number; pageSize: number },
): Promise<{ rows: CreditHistoryRow[]; total: number; page: number; pageCount: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(options.pageSize, 10), MAX_PAGE_SIZE);
  const [counted] = rowsOf(
    await db.execute(sql`
      select count(*)::int as n from credit_ledger
      where organization_id = ${organizationId} and amount <> 0
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
    where cl.organization_id = ${organizationId} and cl.amount <> 0
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
