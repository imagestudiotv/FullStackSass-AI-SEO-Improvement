import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin/guard";
import { adminSettlementDetail } from "@/lib/partners/application/queries/admin-reports";
import {
  cancelSettlementAction,
  confirmManualPayPalPayoutAction,
  recordManualPayPalPayoutAction,
  requestTransferReversalAction,
  resumeSettlementAction,
  retrySettlementAction,
  voidManualPayPalPayoutAction,
} from "@/lib/partners/presentation/admin-actions";
import { idSchema } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../../_ui/page";
import { AdminStatus } from "../../../_ui/status";
import { AmountReasonAction } from "../../_ui/amount-action";
import { BANK_LABEL, money, REVIEW_KIND_LABEL, SETTLEMENT_LABEL, TRANSFER_LABEL, when } from "../../_ui/labels";
import { ReasonAction } from "../../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner payout" };

/**
 * Admin -> Partner payouts -> one settlement: every attempt at each step
 * with its stable operation id (the Stripe idempotency key), the reserved
 * commissions, the ledger entries it wrote and its review cases - and the
 * safe actions: retry (reconciles before anything new), cancel (only before
 * anything may have reached Stripe) and transfer reversal.
 */
export default async function PartnerPayoutPage({ params }: PageProps<"/admin/partners/payouts/[id]">) {
  const who = await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const detail = await adminSettlementDetail(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, id);
  if (!detail) notFound();
  const { settlement, partner } = detail;
  const [stateTone, stateLabel] = SETTLEMENT_LABEL[settlement.state];
  const [transferTone, transferLabel] = TRANSFER_LABEL[detail.transfer];
  const [bankTone, bankLabel] = BANK_LABEL[detail.bank];

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title={`${money(settlement.transferAmount, settlement.currency)} to ${partner?.displayName ?? "a partner"}`}
        description={`Run ${settlement.runKey} · ${settlement.environment === "live" ? "Live" : "Test"} mode`}
        back={{ href: "/admin/partners/payouts", label: "Partner payouts" }}
        meta={
          <>
            <AdminStatus tone={stateTone} label={stateLabel} />
            <span>Transfer:</span>
            <AdminStatus tone={transferTone} label={transferLabel} />
            <span>Bank:</span>
            <AdminStatus tone={bankTone} label={bankLabel} />
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {detail.canRecordManualPayPal ? (
              <ReasonAction
                action={recordManualPayPalPayoutAction.bind(null, settlement.id)}
                label="Record manual PayPal payment…"
                title="Record the PayPal payment you sent?"
                description={`MANUAL payout. First send exactly ${money(settlement.transferAmount, settlement.currency)} in PayPal to ${detail.paypalAccount?.receiver ?? "the partner's confirmed PayPal address"}. Then enter PayPal's transaction id. Nothing is settled until another administrator confirms it.`}
                confirmLabel="Record payment"
                success="Manual payment recorded"
                field={{ label: "PayPal transaction id", hint: "17 characters, from the payment in PayPal's activity.", initial: "", required: true, maxLength: 17 }}
              />
            ) : null}
            {detail.manualPending ? (
              <>
                <ReasonAction
                  action={confirmManualPayPalPayoutAction.bind(null, settlement.id)}
                  label="Confirm manual PayPal payment…"
                  title="Confirm this payment in PayPal?"
                  description={`MANUAL payout recorded by ${detail.manualPending.recordedBy ?? "someone"}. Open PayPal's activity, find ${detail.manualPending.transactionId}, check it is completed, for ${money(settlement.transferAmount, settlement.currency)}, to ${detail.manualPending.receiver}. Type the transaction id again to confirm. This settles the payout.`}
                  confirmLabel="Confirm and settle"
                  success="Payout settled"
                  field={{ label: "Transaction id, as shown in PayPal", hint: "Must match what was recorded.", initial: "", required: true, maxLength: 17 }}
                />
                <ReasonAction
                  action={voidManualPayPalPayoutAction.bind(null, settlement.id)}
                  label="Void recorded payment…"
                  title="Void the recorded PayPal payment?"
                  description="Only if the payment did NOT go through in PayPal (cancelled, reversed or never sent). The payout goes back to waiting, so it can be sent again."
                  confirmLabel="Void"
                  success="Recorded payment voided"
                  tone="danger"
                />
              </>
            ) : null}
            {detail.retryable ? (
              <ReasonAction
                action={retrySettlementAction.bind(null, settlement.id)}
                label="Retry now…"
                title="Retry this payout now?"
                description="Runs the next step now. An unknown transfer is first looked up at Stripe by its transfer group and repeated only with the same idempotency key, so nothing can be sent twice."
                confirmLabel="Retry"
                success="Retried"
              />
            ) : null}
            {detail.resumable ? (
              <ReasonAction
                action={resumeSettlementAction.bind(null, settlement.id)}
                label="Resume after review…"
                title="Resume this payout?"
                description="Only after the review case is understood. It goes back to the state Stripe's evidence supports - transferred if the transfer is confirmed, otherwise waiting for (or sending) its transfer - and is executed again with every check."
                confirmLabel="Resume"
                success="Payout resumed"
              />
            ) : null}
            {detail.cancellable ? (
              <ReasonAction
                action={cancelSettlementAction.bind(null, settlement.id)}
                label="Cancel…"
                title="Cancel this payout?"
                description="Nothing was sent to Stripe. The reserved commissions become available again for a later run."
                confirmLabel="Cancel payout"
                success="Payout cancelled"
                tone="danger"
              />
            ) : null}
            {detail.reversible > BigInt(0) ? (
              <AmountReasonAction
                action={requestTransferReversalAction.bind(null, settlement.id)}
                label="Reverse transfer…"
                title="Reverse part of this transfer?"
                description={`Pulls money back from the partner's Stripe balance - at most what they owe back and at most ${money(detail.reversible, settlement.currency)} (what remains of this transfer). Use it after a refund or chargeback left the partner owing.`}
                confirmLabel="Request reversal"
                success="Reversal requested"
                amountHint={`In ${settlement.currency.toUpperCase()}, for example 24.75.`}
                tone="danger"
              />
            ) : null}
          </div>
        }
      />

      <AdminSection title="Settlement">
        <AdminFacts
          items={[
            { label: "Partner", value: partner ? <Link className="underline underline-offset-4" href={`/admin/partners/partners/${partner.id}`}>{partner.displayName}</Link> : "-" },
            { label: "Gross (reserved commissions)", value: money(settlement.grossAmount, settlement.currency) },
            { label: "Deducted (corrections)", value: money(settlement.offsetAmount, settlement.currency) },
            { label: "Transfer amount", value: money(settlement.transferAmount, settlement.currency) },
            { label: "Paid through", value: settlement.payoutMethod === "paypal" ? `PayPal (${detail.paypalMode === "manual" ? "manual" : detail.paypalMode})` : "Stripe" },
            settlement.payoutMethod === "paypal"
              ? { label: "PayPal address", value: <span className="font-mono">{detail.paypalAccount?.receiver ?? "-"} ({detail.paypalAccount?.status ?? "missing"})</span> }
              : { label: "Connected account", value: <span className="font-mono">{settlement.stripeAccountId}</span> },
            { label: "Transfer group", value: <span className="font-mono break-all">{settlement.transferGroup}</span> },
            { label: "Created", value: when(settlement.createdAt) },
            { label: "Transferred", value: when(settlement.transferredAt) },
            { label: "Paid to bank", value: when(settlement.paidAt) },
            { label: "Attempts / next attempt", value: `${settlement.attempts} · ${when(settlement.nextAttemptAt)}` },
            { label: "Last error", value: settlement.lastError ?? "-" },
            { label: "Settlement id", value: <span className="font-mono">{settlement.id}</span> },
          ]}
        />
      </AdminSection>

      {settlement.payoutMethod === "paypal" ? (
        <AdminSection title="PayPal payments" description="One per sender batch id (PayPal's idempotency key). At most one may have moved money. Manual ones were sent by a person and recorded here.">
          {detail.paypalAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent to PayPal yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {detail.paypalAttempts.map((attempt) => (
                <li key={attempt.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">#{attempt.attemptNumber}</span>
                    <AdminStatus
                      tone={attempt.status === "succeeded" ? "success" : attempt.status === "failed" || attempt.status === "reversed" ? "danger" : "warning"}
                      label={`${attempt.mode} · ${attempt.status}${attempt.providerStatus ? ` (${attempt.providerStatus})` : ""}`}
                    />
                    <span className="tabular-nums">{money(attempt.amount, attempt.currency)}</span>
                    <span className="font-mono">{attempt.receiver}</span>
                  </div>
                  <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>Sender batch: <span className="font-mono break-all">{attempt.senderBatchId}</span></div>
                    <div>Transaction: <span className="font-mono">{attempt.transactionId ?? "-"}</span></div>
                    <div>Fee (paid by RepGet): {attempt.fee !== null ? money(attempt.fee, attempt.currency) : "-"}</div>
                    <div>Recorded by: {attempt.recordedBy ?? "system"}</div>
                    <div>Sent: {when(attempt.submittedAt)}</div>
                    <div>Completed: {when(attempt.completedAt)}</div>
                    {attempt.error ? <div className="sm:col-span-2">Error: {attempt.error}</div> : null}
                    {attempt.note ? <div className="sm:col-span-2">Note: {attempt.note}</div> : null}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      ) : null}

      <AdminSection title="Transfer attempts" description="One per idempotency key. At most one may have moved money.">
        {detail.transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent to Stripe yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.transfers.map((attempt) => (
              <li key={attempt.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">#{attempt.attemptNumber}</span>
                  <AdminStatus tone={attempt.status === "confirmed" ? "success" : attempt.status === "unknown" || attempt.status === "processing" ? "warning" : "neutral"} label={attempt.status.replace(/_/g, " ")} />
                  <span className="tabular-nums">{money(attempt.amount, attempt.currency)}</span>
                  {attempt.amountReversed > BigInt(0) ? <span className="text-muted-foreground">({money(attempt.amountReversed, attempt.currency)} reversed)</span> : null}
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {attempt.operationId}
                  {attempt.stripeTransferId ? ` · ${attempt.stripeTransferId}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Submitted {when(attempt.submittedAt)} · updated {when(attempt.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
        {detail.reversals.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Reversals</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {detail.reversals.map((reversal) => (
                <li key={reversal.id} className="flex flex-wrap gap-2">
                  <span className="tabular-nums">{money(reversal.amount, reversal.currency)}</span>
                  <AdminStatus tone={reversal.status === "confirmed" ? "success" : reversal.status === "failed" ? "danger" : "warning"} label={reversal.status} />
                  <span className="break-all font-mono text-[11px] text-muted-foreground">{reversal.stripeReversalId ?? reversal.operationId}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </AdminSection>

      <AdminSection title="Bank payout attempts" description="Created on the partner's Stripe account after the transfer is confirmed. A failed bank payout never repeats the transfer.">
        {detail.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bank payout yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.payouts.map((attempt) => (
              <li key={attempt.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">#{attempt.attemptNumber}</span>
                  <AdminStatus tone={attempt.status === "paid" ? "success" : attempt.status === "failed" || attempt.status === "canceled" ? "danger" : "info"} label={attempt.status.replace(/_/g, " ")} />
                  <span className="tabular-nums">{money(attempt.amount, attempt.currency)}</span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {attempt.operationId}
                  {attempt.stripePayoutId ? ` · ${attempt.stripePayoutId}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Submitted {when(attempt.submittedAt)} · updated {when(attempt.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Commissions in this payout">
        <ul className="space-y-1 text-sm">
          {detail.items.map((item) => (
            <li key={item.commissionId} className="flex flex-wrap justify-between gap-2">
              <span className="font-mono text-xs">{item.commissionId}</span>
              <span className="tabular-nums">
                {money(item.amount, settlement.currency)}
                {item.active ? "" : " (released)"}
              </span>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Ledger entries" description="What this payout wrote to the immutable ledger.">
        {detail.ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet: the ledger changes only when Stripe confirms a transfer or reversal.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.ledger.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {entry.kind.replace(/_/g, " ")} <span className="font-mono text-[11px] text-muted-foreground">{entry.operationKey}</span>
                </span>
                <span className="tabular-nums">{money(entry.amount, entry.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      {detail.cases.length > 0 ? (
        <AdminSection title="Review cases">
          <ul className="space-y-2 text-sm">
            {detail.cases.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <AdminStatus tone={item.status === "open" ? "warning" : "neutral"} label={item.status} />
                <span className="font-medium">{REVIEW_KIND_LABEL[item.kind]}</span>
                <span className="text-muted-foreground">{item.summary}</span>
                <Link href="/admin/partners/reviews" className="text-xs underline underline-offset-4">
                  Review cases
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}
