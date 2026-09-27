import { sql, type SQL } from "drizzle-orm";

import { RECONCILIATION_SQL } from "@/lib/billing/reconciliation-sql.mjs";

import type { Executor } from "@/lib/db/types";

/**
 * READ-ONLY reconciliation reports.
 *
 * Every function here is a SELECT and nothing else: safe against production,
 * inside a read-only transaction (scripts/reconcile-report.mjs runs the same
 * SQL that way). None of them repairs anything. What to do about a finding -
 * grant a missing credit, cancel a duplicate subscription, re-queue a job -
 * is a decision for a person, because the right answer depends on what the
 * customer was told and what they have already been given.
 *
 * The SQL lives in reconciliation-sql.mjs so the script and the tests run the
 * identical statements. What each report finds is described there.
 */

export const RECONCILIATION_QUERIES = Object.fromEntries(
  Object.entries(RECONCILIATION_SQL).map(([name, text]) => [name, sql.raw(text)]),
) as Record<keyof typeof RECONCILIATION_SQL, SQL>;

export type ReconciliationReport = keyof typeof RECONCILIATION_QUERIES;

/** Runs one report. SELECT only. */
export async function runReconciliation(
  executor: Pick<Executor, "execute">,
  report: ReconciliationReport,
): Promise<Record<string, unknown>[]> {
  const result = await executor.execute(RECONCILIATION_QUERIES[report]);
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Record<
    string,
    unknown
  >[];
}
