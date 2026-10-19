import { Banknote, Download } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { adminPayoutPreview, adminSettlements, SETTLEMENT_FILTERS } from "@/lib/partners/application/queries/admin-reports";
import type { SettlementState } from "@/lib/partners/domain/entities/settlement";
import { prepareSettlementNowAction, reconcileNowAction, runMonthlySettlementsAction } from "@/lib/partners/presentation/admin-actions";
import { partnerDeps } from "@/lib/partners/server";

import { AdminFacts, AdminPage, AdminPageHeader, AdminSection } from "../../_ui/page";
import { AdminEmpty, AdminUnavailable } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { BANK_LABEL, BLOCKER_LABEL, CARRY_REASON, money, SETTLEMENT_LABEL, TRANSFER_LABEL, when } from "../_ui/labels";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner payouts" };

const FILTERS: ToolbarFilter[] = [
  {
    param: "state",
    label: "State",
    allValue: "all",
    options: [{ value: "all", label: "All" }, ...SETTLEMENT_FILTERS.map((value) => ({ value, label: SETTLEMENT_LABEL[value][1] }))],
  },
];

/**
 * Admin -> Partner payouts: what the next monthly run would pay (the same
 * plan the run uses, nothing reserved), the run itself, and every
 * settlement with its two separate steps - the Stripe transfer and the bank
 * payout. Nothing here marks money transferred or paid: only Stripe's
 * evidence does.
 */
export default async function PartnerPayoutsPage({ searchParams }: PageProps<"/admin/partners/payouts">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const admin = { kind: "admin" as const, userId: who.userId, email: who.email };
  const state = (SETTLEMENT_FILTERS as readonly string[]).includes(String(params.state)) ? (params.state as SettlementState) : undefined;
  const deps = partnerDeps();
  const [preview, settlements] = await Promise.all([
    adminPayoutPreview(deps, admin, { page: pageFrom(params.preview) }),
    adminSettlements(deps, admin, { state, page: pageFrom(params.page) }),
  ]);
  const blocked = !preview.environment || !preview.payoutsOn || !preview.moneyMovementAllowed;

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Partner payouts"
        description="Monthly on the 1st (00:00 UTC): mature commissions (Net 30) at or above the threshold are sent to each partner's Stripe account, then paid out to their bank. Each step is confirmed by Stripe."
        back={{ href: "/admin/partners", label: "Affiliate program" }}
        actions={
          <>
            <Link href="/admin/partners/export/settlements" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Link>
            <ReasonAction
              action={reconcileNowAction}
              label="Reconcile now…"
              title="Run the reconciliation now?"
              description="Compares payments, commissions, the ledger and Stripe transfers. Findings become review cases; missed payments are queued again. Nothing financial is edited."
              confirmLabel="Reconcile"
              success="Reconciliation finished"
            />
            <ReasonAction
              action={runMonthlySettlementsAction}
              label="Run monthly payouts now…"
              title="Run this month's payouts now?"
              description="Prepares this month's settlement for every partner and currency that qualifies, and sends them through Stripe. Each partner still gets at most one payout per currency per month."
              confirmLabel="Run payouts"
              success="Payout run finished"
              tone="danger"
            />
          </>
        }
      />

      <AdminSection title="Readiness">
        <AdminFacts
          items={[
            { label: "Stripe environment", value: preview.environment ? (preview.environment === "live" ? "Live" : "Test") : "Not configured" },
            { label: "Payouts switch", value: preview.payoutsOn ? "On" : "Off - nothing new is sent" },
            {
              label: "Money movement",
              value: preview.environment === "live" ? (preview.moneyMovementAllowed ? "Allowed (PARTNER_LIVE_PAYOUTS)" : "Blocked: PARTNER_LIVE_PAYOUTS is not 'enabled'") : "Test mode",
            },
            { label: "Next monthly run", value: when(preview.nextRunAt) },
            { label: "This month's run key", value: <span className="font-mono">{preview.currentRunKey}</span> },
          ]}
        />
        {blocked ? <p className="mt-3 text-sm text-muted-foreground">While any of these blocks payouts, the run and “Prepare now” prepare nothing and say why.</p> : null}
      </AdminSection>

      <AdminSection title="Next run preview" description="Computed with the run's own rules from the ledger. Nothing is reserved by looking." bodyClassName="p-0">
        {!preview.environment ? (
          <div className="p-5">
            <AdminUnavailable title="Stripe is not configured" description="Set STRIPE_SECRET_KEY to compute payouts." />
          </div>
        ) : preview.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No partner has a balance yet.</p>
        ) : (
          <>
            <Table minWidth="900px">
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Would pay</TableHead>
                  <TableHead>Blockers</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={`${row.partner?.id}-${row.currency}`}>
                    <TableCell>
                      {row.partner ? (
                        <Link href={`/admin/partners/partners/${row.partner.id}`} className="underline-offset-4 hover:underline">
                          {row.partner.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="uppercase">{row.currency}</TableCell>
                    <TableCell>
                      {!row.plan ? (
                        "-"
                      ) : row.plan.kind === "settle" ? (
                        <span>
                          <span className="font-medium tabular-nums">{money(row.plan.transferAmount.amount, row.currency)}</span>
                          {row.plan.offset.isPositive() ? <span className="block text-xs text-muted-foreground">after {money(row.plan.offset.amount, row.currency)} deducted</span> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Nothing: {CARRY_REASON[row.plan.reason] ?? row.plan.reason}
                          {row.plan.payable.isPositive() ? ` (${money(row.plan.payable.amount, row.currency)} payable)` : ""}
                          {row.plan.reason === "below_threshold" && row.threshold !== null ? `, threshold ${money(row.threshold, row.currency)}` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.blockers.length === 0 ? (
                        <AdminStatus tone="success" label="None" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.blockers.map((blocker) => (
                            <AdminStatus key={blocker} tone="warning" label={BLOCKER_LABEL[blocker] ?? blocker} />
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.preparedThisMonth ? (
                        <span className="text-xs text-muted-foreground">This month&apos;s payout exists; next run {when(preview.nextRunAt, false)}</span>
                      ) : row.partner && row.plan?.kind === "settle" && row.blockers.length === 0 ? (
                        <ReasonAction
                          action={prepareSettlementNowAction.bind(null, row.partner.id, row.currency)}
                          label="Prepare now…"
                          title={`Pay ${row.partner.name} now?`}
                          description={`Prepares this month's settlement of ${money(row.plan.transferAmount.amount, row.currency)} and sends it through Stripe. It counts as this month's payout for this currency.`}
                          confirmLabel="Prepare and send"
                          success="Payout prepared"
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.total > preview.pageSize ? (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-sm">
                <span className="text-muted-foreground">
                  {(preview.page - 1) * preview.pageSize + 1}-{Math.min(preview.page * preview.pageSize, preview.total)} of {preview.total} balances
                </span>
                <span className="flex gap-2">
                  {preview.page > 1 ? (
                    <Link className="rounded-md border px-2.5 py-1 hover:bg-muted" href={`/admin/partners/payouts?preview=${preview.page - 1}`}>
                      Previous
                    </Link>
                  ) : null}
                  {preview.page * preview.pageSize < preview.total ? (
                    <Link className="rounded-md border px-2.5 py-1 hover:bg-muted" href={`/admin/partners/payouts?preview=${preview.page + 1}`}>
                      Next
                    </Link>
                  ) : null}
                </span>
              </div>
            ) : null}
          </>
        )}
      </AdminSection>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Settlements</h2>
        <AdminToolbar filters={FILTERS} resultLabel={`${settlements.total} settlement${settlements.total === 1 ? "" : "s"}`} />
        {settlements.rows.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <AdminEmpty filtering={Boolean(state)} icon={Banknote} noun="settlements" title="No payouts yet" description="Settlements appear when the monthly run (or Prepare now) reserves a partner's mature earnings." clearHref="/admin/partners/payouts" />
          </div>
        ) : (
          <AdminTableCard footer={<Pagination page={settlements.page} pageSize={settlements.pageSize} total={settlements.total} basePath="/admin/partners/payouts" params={{ state }} />}>
            <Table minWidth="1000px">
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead data-numeric>Amount</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Transfer</TableHead>
                  <TableHead>Bank payout</TableHead>
                  <TableHead>Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.rows.map((row) => {
                  const [stateTone, stateLabel] = SETTLEMENT_LABEL[row.state];
                  const [transferTone, transferLabel] = TRANSFER_LABEL[row.transfer];
                  const [bankTone, bankLabel] = BANK_LABEL[row.bank];
                  return (
                    <TableRow key={row.id}>
                      <TableCell data-align="top">
                        <Link href={`/admin/partners/payouts/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                          {when(row.createdAt)}
                        </Link>
                        <p className="font-mono text-[11px] text-muted-foreground">{row.runKey}</p>
                      </TableCell>
                      <TableCell data-align="top">{row.partner?.name ?? "-"}</TableCell>
                      <TableCell data-numeric data-align="top">
                        {money(row.transferAmount, row.currency)}
                        {row.offsetAmount > BigInt(0) ? <p className="text-xs text-muted-foreground">gross {money(row.grossAmount, row.currency)}</p> : null}
                      </TableCell>
                      <TableCell data-align="top">
                        <AdminStatus tone={stateTone} label={stateLabel} />
                      </TableCell>
                      <TableCell data-align="top">
                        <AdminStatus tone={transferTone} label={transferLabel} />
                        {row.stripeTransferId ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.stripeTransferId}</p> : null}
                      </TableCell>
                      <TableCell data-align="top">
                        <AdminStatus tone={bankTone} label={bankLabel} />
                        {row.bankArrivalDate ? <p className="mt-1 text-xs text-muted-foreground">arrival {when(row.bankArrivalDate, false)}</p> : null}
                      </TableCell>
                      <TableCell data-align="top">
                        {row.attempts}
                        {row.lastError ? <p className="max-w-[200px] text-xs text-muted-foreground">{row.lastError}</p> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AdminTableCard>
        )}
      </div>
    </AdminPage>
  );
}
