import { Link2 } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { adminAttributions } from "@/lib/partners/application/queries/admin-reports";
import { confirmAttributionAction, disqualifyAttributionAction } from "@/lib/partners/presentation/admin-actions";
import { idSchema } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus, type StatusTone } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { when } from "../_ui/labels";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner referrals" };

const STATUSES = ["active", "review", "disqualified"] as const;
const STATUS: Record<(typeof STATUSES)[number], [StatusTone, string]> = {
  active: ["success", "Active"],
  review: ["warning", "Held for review"],
  disqualified: ["neutral", "Disqualified"],
};
const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "all",
    options: [{ value: "all", label: "All" }, ...STATUSES.map((value) => ({ value, label: STATUS[value][1] }))],
  },
];

/**
 * Admin -> Partner referrals (attribution history): which partner each
 * customer workspace is attributed to, how (first-touch link or coupon),
 * when the commission window ends, and the decisions on it. An attribution
 * is locked once made and never moved to another partner.
 */
export default async function PartnerAttributionPage({ searchParams }: PageProps<"/admin/partners/attribution">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(params.status)) ? (params.status as (typeof STATUSES)[number]) : undefined;
  const partnerId = typeof params.partner === "string" && idSchema.safeParse(params.partner).success ? params.partner : undefined;
  const result = await adminAttributions(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, { status, partnerId, page: pageFrom(params.page) });

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Partner referrals"
        description="Attribution history: one partner per customer workspace, locked at signup (first-touch link) or first checkout (coupon). Conflicts and fraud signals are held for review, never decided automatically."
        back={{ href: "/admin/partners", label: "Affiliate program" }}
      />
      <AdminToolbar filters={FILTERS} keep={partnerId ? ["partner"] : []} resultLabel={`${result.total} referral${result.total === 1 ? "" : "s"}`} />
      {result.rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={Boolean(status || partnerId)} icon={Link2} noun="referrals" title="No referrals yet" description="A referral is recorded when a new customer signs up through a partner link or checks out with a partner coupon." clearHref="/admin/partners/attribution" />
        </div>
      ) : (
        <AdminTableCard footer={<Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/partners/attribution" params={{ status, partner: partnerId }} />}>
          <Table minWidth="1000px">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Locked</TableHead>
                <TableHead>Window ends</TableHead>
                <TableHead data-numeric>Payments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => {
                const [tone, label] = STATUS[row.status];
                return (
                  <TableRow key={row.attributionId}>
                    <TableCell data-align="top">
                      {row.customer?.name ?? "-"}
                      <p className="text-xs text-muted-foreground">{row.customer?.domain ?? row.customer?.reference}</p>
                    </TableCell>
                    <TableCell data-align="top">
                      {row.partner ? (
                        <Link className="underline-offset-4 hover:underline" href={`/admin/partners/partners/${row.partner.id}`}>
                          {row.partner.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell data-align="top" className="capitalize">{row.source}</TableCell>
                    <TableCell data-align="top">{when(row.lockedAt)}</TableCell>
                    <TableCell data-align="top">{row.windowEndsAt ? when(row.windowEndsAt, false) : "Starts with the first payment"}</TableCell>
                    <TableCell data-numeric data-align="top">{row.payments}</TableCell>
                    <TableCell data-align="top">
                      <AdminStatus tone={tone} label={label} />
                    </TableCell>
                    <TableCell data-align="top">
                      <div className="flex flex-wrap gap-1.5">
                        {row.status === "review" ? (
                          <ReasonAction
                            action={confirmAttributionAction.bind(null, row.attributionId)}
                            label="Confirm…"
                            title="Confirm this referral?"
                            description="It counts for the partner: commissions held for review are approved (unless the customer is also a credit referral)."
                            confirmLabel="Confirm"
                            success="Referral confirmed"
                          />
                        ) : null}
                        {row.status !== "disqualified" ? (
                          <ReasonAction
                            action={disqualifyAttributionAction.bind(null, row.attributionId)}
                            label="Disqualify…"
                            title="Disqualify this referral?"
                            description="It earns nothing more and its unpaid commissions are rejected. Paid money stays recorded; recover it with a transfer reversal."
                            confirmLabel="Disqualify"
                            success="Referral disqualified"
                            tone="danger"
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
    </AdminPage>
  );
}
