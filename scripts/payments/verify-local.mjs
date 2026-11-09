/**
 * After the owner's test-mode / sandbox run (docs/payment-provider-checks.md):
 * what each flow recorded in the LOCAL verification database. Read-only; run
 * only through owner-check.mjs, which refuses a database not on this machine.
 * Prints amounts and states, never addresses or secrets.
 */
import postgres from "postgres";

const sql = postgres(process.env.VERIFY_DATABASE_URL, { max: 1, connect_timeout: 15 });
const section = (title) => console.log(`\n== ${title}`);
const table = (rows) => (rows.length ? console.table(rows.map((r) => ({ ...r }))) : console.log("  (none)"));

section("Payments (newest 20): status, refunded_cents, provider_object");
table(await sql`select provider, provider_object, amount_cents, refunded_cents, currency, status, description, paid_at from payments order by paid_at desc limit 20`);

section("Refunds: one row per refund operation; unknown/requested must be resolved");
table(await sql`select r.provider, r.source, r.status, r.amount_cents, r.currency, r.provider_refund_id is not null as has_provider_id, r.created_at from payment_refunds r order by r.created_at desc limit 20`);

section("PayPal one-off orders: completed ones must have fulfilled_at");
table(await sql`select purpose, status, amount_cents, currency, paypal_capture_id is not null as captured, fulfilled_at, error, created_at from paypal_orders order by created_at desc limit 20`);

section("Credit-pack purchases by PayPal: exactly one per completed addon order");
table(await sql`select o.id as order_row, count(p.id)::int as purchases, sum(case when l.id is null then 0 else 1 end)::int as credit_grants from paypal_orders o left join addon_purchases p on p.paypal_order_id = o.id left join credit_ledger l on l.reference_id = p.id and l.type = 'purchase' where o.purpose = 'addon_credits' and o.status = 'completed' group by o.id`);

section("Partner facts from PayPal: one per sale; reversals cumulative");
table(await sql`select f.provider, f.outcome, f.cash_collected, f.refunded_amount, f.dispute_lost_amount, c.amount as commission, c.reversed_amount, c.status from partner_payment_facts f left join partner_commissions c on c.payment_fact_id = f.id where f.provider = 'paypal' order by f.paid_at desc limit 20`);

section("Partner PayPal payouts: at most one live attempt per settlement");
table(await sql`select s.state, s.payout_method, s.transfer_amount, a.mode, a.status, a.provider_status, a.fee, a.attempt_number from partner_settlements s left join partner_paypal_payouts a on a.settlement_id = s.id where s.payout_method = 'paypal' order by s.created_at desc limit 20`);

section("Ledger for PayPal payouts: one transfer_confirmed per succeeded attempt");
table(await sql`select kind, amount, operation_key, created_at from partner_ledger_entries where operation_key like 'paypal-payout%' order by created_at desc limit 20`);

await sql.end();
