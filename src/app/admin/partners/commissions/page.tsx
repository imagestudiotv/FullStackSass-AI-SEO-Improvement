import { Coins, Download } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { adminCommissions, COMMISSION_FILTERS, type CommissionFilter } from "@/lib/partners/application/queries/admin-reports";
import { approveCommissionAction, holdCommissionAction, rejectCommissionAction } from "@/lib/partners/presentation/admin-actions";
import { rateLabel } from "@/lib/partners/presentation/format";
import { idSchema, reportPeriod } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty, AdminUnavailable } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { COMMISSION_LABEL, money, when } from "../_ui/labels";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner commissions" };

const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "all",
    options: [{ value: "all", label: "All" }, ...COMMISSION_FILTERS.map((value) => ({ value, label: COMMISSION_LABEL[value][1] }))],
  },
];

/**
 * Admin -> Partner commissions: every commission with the payment it came
 * from, its calculation and its state, and the decisions on it (approve,
 * reject, hold, release - each with a reason, audited).
 */
export default async function PartnerCommissionsPage({ searchParams }: PageProps<"/admin/partners/commissions">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const status = (COMMISSION_FILTERS as readonly string[]).includes(String(params.status)) ? (params.status as CommissionFilter) : undefined;
  const partnerId = typeof params.partner === "string" && idSchema.safeParse(params.partner).success ? params.partner : undefined;
  const period = reportPeriod(params.from, params.to);
  const result = await adminCommissions(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, { status, partnerId, from: period.from, to: period.to, page: pageFrom(params.page) });
  const exportQuery = new URLSearchParams(Object.entries({ partner: partnerId, from: period.fromText, to: period.toText }).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Partner commissions"
        description="One commission per commissionable Stripe payment of a referred customer: the base excludes tax, discounts and credits; refunds and chargebacks reverse it. Amounts never change - corrections are new ledger entries."
        back={{ href: "/admin/partners", label: "Affiliate program" }}
        actions={
          <Link href={`/admin/partners/export/commissions${exportQuery ? `?${exportQuery}` : ""}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Link>
        }
      />
      {!result.environment ? (
        <AdminUnavailable title="Stripe is not configured" description="Commissions are recorded per Stripe environment. Set STRIPE_SECRET_KEY to see them." />
      ) : (
        <>
          <AdminToolbar filters={FILTERS} keep={["partner", "from", "to"]} resultLabel={`${result.total} commission${result.total === 1 ? "" : "s"} (${result.environment})`} />
          {/* The period, by payment date (UTC): a plain form, so it works without scripts. */}
          <form method="get" className="flex flex-wrap items-end gap-3 text-sm" aria-label="Payment date period">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {partnerId ? <input type="hidden" name="partner" value={partnerId} /> : null}
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Paid from (UTC)</span>
              <input type="date" name="from" defaultValue={period.fromText} className="h-9 rounded-md border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">to (included)</span>
              <input type="date" name="to" defaultValue={period.toText} className="h-9 rounded-md border bg-background px-2 focus-visible:outline-2 focus-visible:outline-ring" />
            </label>
            <button type="submit" className="h-9 rounded-md border px-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              Apply period
            </button>
            {period.fromText || period.toText ? (
              <Link href={`/admin/partners/commissions${partnerId ? `?partner=${partnerId}` : ""}`} className="h-9 content-center text-muted-foreground underline underline-offset-4">
                All dates
              </Link>
            ) : null}
          </form>
          {result.rows.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <AdminEmpty filtering={Boolean(status || partnerId)} icon={Coins} noun="commissions" title="No commissions yet" description="They appear when a referred customer pays through Stripe." clearHref="/admin/partners/commissions" />
            </div>
          ) : (
            <AdminTableCard footer={<Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/partners/commissions" params={{ status, partner: partnerId, from: period.fromText, to: period.toText }} />}>
              <Table minWidth="1100px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead data-numeric>Base</TableHead>
                    <TableHead data-numeric>Rate</TableHead>
                    <TableHead data-numeric>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Decisions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => {
                    const [tone, label] = COMMISSION_LABEL[row.display];
                    const open = row.status === "pending" || row.status === "available";
                    const adminHold = row.holdReason?.startsWith("admin:") ?? false;
                    return (
                      <TableRow key={row.id}>
                        <TableCell data-align="top">
                          {when(row.paidAt, false)}
                          <p className="font-mono text-[11px] text-muted-foreground">{row.id.slice(0, 8)}</p>
                        </TableCell>
                        <TableCell data-align="top">
                          {row.partner ? (
                            <Link href={`/admin/partners/partners/${row.partner.id}`} className="underline-offset-4 hover:underline">
                              {row.partner.name}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell data-align="top">
                          {row.customer?.name ?? "-"}
                          <p className="text-xs text-muted-foreground">{row.customer?.domain ?? row.customer?.reference}</p>
                        </TableCell>
                        <TableCell data-numeric data-align="top">{money(row.baseAmount, row.currency)}</TableCell>
                        <TableCell data-numeric data-align="top">
                          {rateLabel(row.rateBasisPoints)}
                          <p className="text-xs capitalize text-muted-foreground">{row.tierKey}</p>
                        </TableCell>
                        <TableCell data-numeric data-align="top">
                          {money(row.amount, row.currency)}
                          {row.reversedAmount > BigInt(0) ? <p className="text-xs text-muted-foreground">-{money(row.reversedAmount, row.currency)} reversed</p> : null}
                        </TableCell>
                        <TableCell data-align="top">
                          <AdminStatus tone={tone} label={label} />
                          {row.holdReason ? <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{row.holdReason.replace(/^admin:/, "Admin: ")}</p> : null}
                          {open ? <p className="mt-1 text-xs text-muted-foreground">Matures {when(row.maturesAt, false)}</p> : null}
                        </TableCell>
                        <TableCell data-align="top">
                          <div className="flex flex-wrap gap-1.5">
                            {open && row.reviewState === "needs_review" ? (
                              <ReasonAction
                                action={approveCommissionAction.bind(null, row.id)}
                                label="Approve…"
                                title="Approve this commission?"
                                description="It becomes payable once it matures, at the next monthly run."
                                confirmLabel="Approve"
                                success="Commission approved"
                              />
                            ) : null}
                            {open && row.reviewState !== "rejected" ? (
                              <ReasonAction
                                action={rejectCommissionAction.bind(null, row.id)}
                                label="Reject…"
                                title="Reject this commission?"
                                description="It will not be paid. A reversing entry is added to the ledger; the original stays."
                                confirmLabel="Reject"
                                success="Commission rejected"
                                tone="danger"
                              />
                            ) : null}
                            {open && !row.holdReason ? (
                              <ReasonAction
                                action={holdCommissionAction.bind(null, row.id, true)}
                                label="Hold…"
                                title="Hold this commission?"
                                description="No payout takes it until the hold is released."
                                confirmLabel="Hold"
                                success="Commission held"
                              />
                            ) : null}
                            {open && adminHold ? (
                              <ReasonAction
                                action={holdCommissionAction.bind(null, row.id, false)}
                                label="Release…"
                                title="Release the hold?"
                                description="It becomes payable again once mature (and approved)."
                                confirmLabel="Release"
                                success="Hold released"
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminTableCard>
          )}
        </>
      )}
    </AdminPage>
  );
}
