import { describe, expect, it } from "vitest";

import { RECONCILIATION_SQL } from "@/lib/billing/reconciliation-sql.mjs";
import { createTestDb } from "@/test/db";

/**
 * The partner reports added to `npm run reconcile:report` run against the
 * real schema (all migrations replayed) and are read-only SELECTs.
 */
describe("partner reconciliation reports", () => {
  it("run on the migrated schema and only read", async () => {
    const { client } = await createTestDb();
    const partnerReports = Object.entries(RECONCILIATION_SQL).filter(([name]) => name.startsWith("partner"));
    expect(partnerReports.map(([name]) => name).sort()).toEqual([
      "partnerEarnedMismatches",
      "partnerOpenReviewCases",
      "partnerPaymentsWithoutFacts",
      "partnerReversalMismatches",
      "partnerStuckProviderEvents",
    ]);
    for (const [, statement] of partnerReports) {
      expect(statement.trim().toLowerCase().startsWith("select")).toBe(true);
      const result = await client.query(statement);
      expect(result.rows).toEqual([]);
    }
  });
});
