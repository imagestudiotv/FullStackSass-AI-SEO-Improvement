import { inngest } from "@/inngest/client";
import { executeSettlement } from "@/lib/partners/application/use-cases/execute-transfer";
import { runMonthlySettlements } from "@/lib/partners/application/use-cases/prepare-settlement";
import { partnerDeps } from "@/lib/partners/server";

/**
 * Partner payouts through Stripe Connect.
 *
 *  - partner-payouts-monthly: 00:00 UTC (Inngest crons are UTC) on the first
 *    day of every month,
 *    prepares one settlement per partner and currency whose mature balance
 *    reaches the threshold (prepare-settlement.ts); anything below carries
 *    forward.
 *  - partner-settlement-execute: one settlement's transfer and bank payout,
 *    queued through the outbox when the settlement is prepared.
 *  - partner-payouts-sweep (every ten minutes): retries due settlements,
 *    reconciles unknown outcomes and polls bank payouts in flight - whether or
 *    not the partner_payouts switch is on, because operations already
 *    submitted to Stripe must keep being tracked.
 *
 * Every step claims the settlement's lease and is safe to retry: operation
 * ids are stable, and a lease running out is never taken as proof that
 * Stripe did nothing.
 */

export const partnerPayoutsMonthly = inngest.createFunction(
  { id: "partner-payouts-monthly", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "0 0 1 * *" }] },
  async ({ step }) => {
    const run = await step.run("prepare", async () => {
      const result = await runMonthlySettlements(partnerDeps());
      return {
        runKey: result.runKey,
        created: result.results.filter((r) => r.outcome.kind === "created").length,
        carriedForward: result.results.filter((r) => r.outcome.kind === "carried_forward").length,
        skipped: result.results.filter((r) => r.outcome.kind === "skipped").map((r) => (r.outcome.kind === "skipped" ? r.outcome.reason : "")),
      };
    });
    return run;
  },
);

export const partnerSettlementExecute = inngest.createFunction(
  { id: "partner-settlement-execute", retries: 3, concurrency: { limit: 4 }, triggers: [{ event: "partners/settlement.execute" }] },
  async ({ event, step }) => {
    const settlementId = String((event.data as { settlementId?: unknown }).settlementId ?? "");
    return step.run("execute", () => executeSettlement(partnerDeps(), settlementId));
  },
);

export const partnerPayoutsSweep = inngest.createFunction(
  { id: "partner-payouts-sweep", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => {
    const ids = await step.run("due", () => partnerDeps().uow.repositories.settlements.due(new Date(), 25));
    const results: string[] = [];
    for (const settlementId of ids) {
      const result = await step.run(`execute-${settlementId}`, () => executeSettlement(partnerDeps(), settlementId));
      results.push(`${settlementId}:${result.state}`);
    }
    return { executed: results };
  },
);
