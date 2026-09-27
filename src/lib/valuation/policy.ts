import { and, desc, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { valuationPolicies } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * ESTIMATED EQUIVALENT VALUE - how RepGet puts a money figure on traffic and
 * backlinks, and the only place it does.
 *
 * The dashboard used to multiply by two hidden constants ($2.50 a click, $180
 * a backlink) that nobody had sourced. Now every figure comes from a
 * VERSIONED policy an administrator publishes (valuation_policies): its
 * currency, its rates, where the rates come from and when they took effect
 * are stored with it and shown in the methodology. No policy: no estimate -
 * the interface says "Estimate not configured" instead of inventing prices.
 *
 * WHAT IS VALUED, and what never is:
 *   - Traffic: Search Console CLICKS to pages RepGet published for the
 *     website (page-scoped, not the whole site). Either each article's clicks
 *     times the cost per click of the keyword it targets, from the website's
 *     own keyword research for its market (DataForSEO reports USD, so only a
 *     USD policy uses it) - or a fixed rate per click. Google Analytics users
 *     and sessions are never mixed into this.
 *   - Backlinks: VERIFIED received network links only, one rate per source
 *     authority band. Drafts, links awaiting publication or verification,
 *     links never found, removed links, internal links and the "Powered by
 *     RepGet" footer are never valued.
 *
 * These are estimates of what equivalent paid clicks or bought links would
 * cost - not savings, revenue or return anybody was paid.
 */

export type ClickValueMode = "keyword_cpc" | "fixed" | "none";
export type BacklinkRate = { minRank: number | null; value: number };

export type ValuationPolicy = {
  id: string;
  version: number;
  currency: string;
  clickValueMode: ClickValueMode;
  fixedClickRate: number | null;
  backlinkRates: BacklinkRate[];
  sources: string;
  notes: string | null;
  effectiveFrom: Date;
  createdBy: string | null;
};

/** The currency keyword CPCs are stored in (DataForSEO Labs reports USD). */
export const KEYWORD_CPC_CURRENCY = "USD";

function toPolicy(row: typeof valuationPolicies.$inferSelect): ValuationPolicy {
  const rates = Array.isArray(row.backlinkRates) ? (row.backlinkRates as BacklinkRate[]) : [];
  return {
    id: row.id,
    version: row.version,
    currency: row.currency,
    clickValueMode: (["keyword_cpc", "fixed", "none"].includes(row.clickValueMode) ? row.clickValueMode : "none") as ClickValueMode,
    fixedClickRate: row.fixedClickRate === null ? null : Number(row.fixedClickRate),
    backlinkRates: rates
      .filter((r) => typeof r.value === "number" && (r.minRank === null || typeof r.minRank === "number"))
      .map((r) => ({ minRank: r.minRank, value: r.value })),
    sources: row.sources,
    notes: row.notes,
    effectiveFrom: row.effectiveFrom,
    createdBy: row.createdBy,
  };
}

/** The policy in force: the newest version whose effective date has passed. */
export async function activePolicy(now: Date = new Date(), executor: Executor = db): Promise<ValuationPolicy | null> {
  const [row] = await executor
    .select()
    .from(valuationPolicies)
    .where(and(lte(valuationPolicies.effectiveFrom, now)))
    .orderBy(desc(valuationPolicies.effectiveFrom), desc(valuationPolicies.version))
    .limit(1);
  return row ? toPolicy(row) : null;
}

export async function listPolicies(executor: Executor = db): Promise<ValuationPolicy[]> {
  const rows = await executor.select().from(valuationPolicies).orderBy(desc(valuationPolicies.version)).limit(50);
  return rows.map(toPolicy);
}

/**
 * The value of ONE verified backlink from a source of this rank (null when
 * unknown), or null when the policy does not value it.
 */
export function backlinkValue(policy: ValuationPolicy | null, rank: number | null): number | null {
  if (!policy || policy.backlinkRates.length === 0) return null;
  if (rank === null) {
    return policy.backlinkRates.find((r) => r.minRank === null)?.value ?? null;
  }
  const band = policy.backlinkRates
    .filter((r) => r.minRank !== null && r.minRank <= rank)
    .sort((a, b) => (b.minRank as number) - (a.minRank as number))[0];
  return band?.value ?? null;
}

/** The same band choice in SQL, for sorting by value. `rank` is a SQL expression. */
export function backlinkValueSql(policy: ValuationPolicy | null, rank: ReturnType<typeof sql>) {
  if (!policy || policy.backlinkRates.length === 0) return sql`null::numeric`;
  const banded = policy.backlinkRates
    .filter((r) => r.minRank !== null)
    .sort((a, b) => (b.minRank as number) - (a.minRank as number));
  const unknown = policy.backlinkRates.find((r) => r.minRank === null)?.value ?? null;
  const whens = banded.map((r) => sql`when ${rank} >= ${r.minRank} then ${r.value}::numeric`);
  return sql`(case when ${rank} is null then ${unknown}::numeric ${sql.join(whens, sql` `)} else null::numeric end)`;
}

/** Whether traffic can be valued under this policy, and how. */
export function clickValuation(policy: ValuationPolicy | null): { mode: ClickValueMode; usable: boolean; reason: string | null } {
  if (!policy) return { mode: "none", usable: false, reason: "not_configured" };
  if (policy.clickValueMode === "none") return { mode: "none", usable: false, reason: "not_valued" };
  if (policy.clickValueMode === "fixed") {
    return policy.fixedClickRate !== null && policy.fixedClickRate >= 0
      ? { mode: "fixed", usable: true, reason: null }
      : { mode: "fixed", usable: false, reason: "missing_rate" };
  }
  return policy.currency === KEYWORD_CPC_CURRENCY
    ? { mode: "keyword_cpc", usable: true, reason: null }
    : { mode: "keyword_cpc", usable: false, reason: "currency_mismatch" };
}

export type PolicyInput = {
  currency: string;
  clickValueMode: ClickValueMode;
  fixedClickRate: number | null;
  backlinkRates: BacklinkRate[];
  sources: string;
  notes: string | null;
  effectiveFrom: Date;
};

/** Validates a new policy. Returns an error message, or null. */
export function validatePolicy(input: PolicyInput): string | null {
  if (!/^[A-Z]{3}$/.test(input.currency)) return "Currency must be a three-letter ISO code, e.g. USD";
  if (!["keyword_cpc", "fixed", "none"].includes(input.clickValueMode)) return "Unknown traffic valuation mode";
  if (input.clickValueMode === "keyword_cpc" && input.currency !== KEYWORD_CPC_CURRENCY) {
    return `Keyword cost per click is reported in ${KEYWORD_CPC_CURRENCY}; use ${KEYWORD_CPC_CURRENCY} or a fixed rate`;
  }
  if (input.clickValueMode === "fixed" && (input.fixedClickRate === null || !(input.fixedClickRate >= 0) || input.fixedClickRate > 1000)) {
    return "A fixed rate per click between 0 and 1000 is required";
  }
  const seen = new Set<string>();
  for (const rate of input.backlinkRates) {
    if (!(rate.value >= 0) || rate.value > 100_000) return "Each backlink rate must be between 0 and 100000";
    if (rate.minRank !== null && (!Number.isInteger(rate.minRank) || rate.minRank < 0 || rate.minRank > 100)) {
      return "Authority bands start at a whole number from 0 to 100";
    }
    const key = String(rate.minRank);
    if (seen.has(key)) return "Each authority band may appear once";
    seen.add(key);
  }
  if (input.sources.trim().length < 10) return "Say where the rates come from (at least 10 characters)";
  if (Number.isNaN(input.effectiveFrom.getTime())) return "A valid effective date is required";
  return null;
}

/**
 * Publishes a new version. Append-only: earlier versions stay, so figures
 * already reported remain traceable. Callers authorize and audit.
 */
export async function publishPolicy(input: PolicyInput, actor: string, executor: Executor = db): Promise<ValuationPolicy> {
  const error = validatePolicy(input);
  if (error) throw new Error(error);
  const [{ next }] = await executor
    .select({ next: sql<number>`coalesce(max(${valuationPolicies.version}), 0)::int + 1` })
    .from(valuationPolicies);
  const [row] = await executor
    .insert(valuationPolicies)
    .values({
      version: next,
      currency: input.currency,
      clickValueMode: input.clickValueMode,
      fixedClickRate: input.fixedClickRate === null ? null : String(input.fixedClickRate),
      backlinkRates: input.backlinkRates,
      sources: input.sources.trim(),
      notes: input.notes?.trim() || null,
      effectiveFrom: input.effectiveFrom,
      createdBy: actor,
    })
    .returning();
  return toPolicy(row);
}
