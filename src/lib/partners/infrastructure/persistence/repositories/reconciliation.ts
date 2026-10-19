import { sql } from "drizzle-orm";

import type { Executor } from "@/lib/db/types";

import type { ReconciliationFinding, ReconciliationRepository } from "../../../application/ports/repositories";

/**
 * The partner program's reconciliation queries. Read-only SQL over the
 * independent records (billing's payments, payment facts, commissions,
 * the ledger), column-qualified throughout.
 */

type Rows<T> = T[];
function rows<T>(result: unknown): Rows<T> {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows: T[] }).rows ?? []);
}

export function reconciliationRepository(db: Executor): ReconciliationRepository {
  return {
    async paymentsWithoutFacts(environment, limit) {
      const result = await db.execute(sql`
        select p.external_id as "invoiceId", p.organization_id as "organizationId"
        from payments p
        join partner_attributions a on a.organization_id = p.organization_id and a.status in ('active', 'review')
        where p.provider = 'stripe'
          and p.status = 'paid'
          and p.amount_cents > 0
          and p.external_id like 'in\\_%'
          and p.paid_at >= a.locked_at - interval '1 day'
          and not exists (
            select 1 from partner_payment_facts f
            where f.environment = ${environment} and f.invoice_id = p.external_id
          )
          and not exists (
            select 1 from partner_provider_events e
            where e.object_id = p.external_id and e.status in ('pending', 'processing')
          )
        order by p.paid_at
        limit ${limit}`);
      return rows<{ invoiceId: string; organizationId: string }>(result);
    },
    async factsWithoutCommission(environment, limit) {
      const result = await db.execute(sql`
        select f.id as "factId", f.invoice_id as "invoiceId", f.organization_id as "organizationId"
        from partner_payment_facts f
        where f.environment = ${environment}
          and f.outcome = 'commissioned'
          and not exists (select 1 from partner_commissions c where c.payment_fact_id = f.id)
        limit ${limit}`);
      return rows<{ factId: string; invoiceId: string; organizationId: string }>(result).map(
        (row): ReconciliationFinding => ({ kind: "fact_without_commission", subject: row.factId, detail: row }),
      );
    },
    async earnedMismatches(environment, limit) {
      const result = await db.execute(sql`
        select c.id as "commissionId", c.amount::text as "amount",
               coalesce(sum(l.amount), 0)::text as "earned", count(l.id)::int as "entries"
        from partner_commissions c
        left join partner_ledger_entries l on l.commission_id = c.id and l.kind = 'commission_earned'
        where c.environment = ${environment}
        group by c.id, c.amount
        having count(l.id) <> 1 or coalesce(sum(l.amount), 0) <> c.amount
        limit ${limit}`);
      return rows<{ commissionId: string; amount: string; earned: string; entries: number }>(result).map(
        (row): ReconciliationFinding => ({ kind: "earned_mismatch", subject: row.commissionId, detail: row }),
      );
    },
    async reversalMismatches(environment, limit) {
      const result = await db.execute(sql`
        select c.id as "commissionId", c.reversed_amount::text as "reversed",
               (-coalesce(sum(l.amount), 0))::text as "ledger"
        from partner_commissions c
        left join partner_ledger_entries l
          on l.commission_id = c.id and l.kind = 'commission_adjustment' and l.operation_key like 'reversal:%'
        where c.environment = ${environment}
        group by c.id, c.reversed_amount
        having -coalesce(sum(l.amount), 0) <> c.reversed_amount
        limit ${limit}`);
      return rows<{ commissionId: string; reversed: string; ledger: string }>(result).map(
        (row): ReconciliationFinding => ({ kind: "reversal_mismatch", subject: row.commissionId, detail: row }),
      );
    },
    async projections(environment) {
      const result = await db.execute(sql`
        select partner_id as "partnerId", currency,
               net_earned::text as "netEarned", net_transferred::text as "netTransferred", liability::text as "liability",
               pending::text as "pending", available::text as "available", reserved::text as "reserved",
               held::text as "held", bank_paid::text as "bankPaid"
        from partner_balance_projections where environment = ${environment}`);
      return rows<Record<string, string>>(result).map((row) => ({
        partnerId: row.partnerId,
        currency: row.currency,
        values: Object.fromEntries(
          ["netEarned", "netTransferred", "liability", "pending", "available", "reserved", "held", "bankPaid"].map((key) => [key, BigInt(row[key])]),
        ),
      }));
    },
  };
}
