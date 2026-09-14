/**
 * Recovers payments that the Stripe webhook received but never recorded.
 *
 * invoice.paid handling read the subscription id from the line item, which
 * Stripe moved to parent.subscription_details.subscription. The handler
 * returned at its guard before the insert, so every invoice was acknowledged
 * and none was stored. The fix is in the route; this replays the invoices
 * already sitting in webhook_events so the history is not lost.
 *
 * Idempotent: the insert defers to the unique index on
 * (provider, external_id), so re-running changes nothing.
 *
 * Safe to delete once run.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const events = await sql`
  select payload from webhook_events
  where provider = 'stripe' and type in ('invoice.paid', 'invoice.payment_failed')
  order by processed_at asc`;

let written = 0;
let skipped = 0;

for (const row of events) {
  const event = row.payload ?? {};
  const invoice = event.data?.object ?? {};
  const details = invoice.parent?.subscription_details;
  const organizationId = details?.metadata?.organizationId;

  if (!invoice.id || !organizationId) {
    skipped += 1;
    console.log(`skip ${invoice.id ?? "(no id)"} — no organization in metadata`);
    continue;
  }

  // Only insert for organizations that still exist; a deleted workspace would
  // fail the foreign key and abort the run.
  const [org] = await sql`select id from organization where id = ${organizationId}`;
  if (!org) {
    skipped += 1;
    console.log(`skip ${invoice.id} — organization ${organizationId} is gone`);
    continue;
  }

  const status = event.type === "invoice.paid" ? "paid" : "failed";
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date(event.created * 1000);

  const result = await sql`
    insert into payments
      (organization_id, provider, external_id, amount_cents, currency,
       status, invoice_url, description, paid_at)
    values
      (${organizationId}, 'stripe', ${invoice.id},
       ${invoice.amount_paid ?? invoice.amount_due ?? 0},
       ${invoice.currency ?? "eur"}, ${status},
       ${invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null},
       ${invoice.lines?.data?.[0]?.description ?? null}, ${paidAt})
    on conflict (provider, external_id) do nothing
    returning id`;

  if (result.length > 0) {
    written += 1;
    console.log(`wrote ${invoice.id} — ${(invoice.amount_paid ?? 0) / 100} ${invoice.currency} (${status})`);
  } else {
    skipped += 1;
    console.log(`skip ${invoice.id} — already recorded`);
  }
}

console.log(`\n${written} written, ${skipped} skipped`);
await sql.end();
