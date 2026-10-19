import { UserCheck } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { formatDate } from "@/lib/i18n/format";
import { adminPartners } from "@/lib/partners/application/queries/admin-overview";
import type { PartnerStatus } from "@/lib/partners/domain/entities/partner";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty } from "../../_ui/states";
import { AdminStatus } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar, type ToolbarFilter } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners" };

const FILTERS: ToolbarFilter[] = [
  {
    param: "status",
    label: "Status",
    allValue: "all",
    options: [
      { value: "all", label: "All" },
      { value: "active", label: "Active" },
      { value: "suspended", label: "Suspended" },
    ],
  },
];
const when = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Admin -> Partners: approved affiliate partners. */
export default async function PartnersPage({ searchParams }: PageProps<"/admin/partners/partners">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const status = params.status === "active" || params.status === "suspended" ? (params.status as PartnerStatus) : undefined;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const { rows, total, page, pageSize } = await adminPartners(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, {
    status,
    search,
    page: pageFrom(params.page),
  });

  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Partners" description="Approved affiliate partners. Open one to suspend or reactivate it, hold its payouts, or see its payout setup." />
      <AdminToolbar searchPlaceholder="Search name, email or referral code" searchLabel="Search partners" filters={FILTERS} resultLabel={`${total} partner${total === 1 ? "" : "s"}`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty filtering={Boolean(search || status)} icon={UserCheck} noun="partners" title="No partners yet" description="Partners appear here once an application is approved." clearHref="/admin/partners/partners" />
        </div>
      ) : (
        <AdminTableCard footer={<Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/partners/partners" params={{ status, q: search }} />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="hidden md:table-cell">Code</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/admin/partners/partners/${row.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                      {row.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.contactEmail}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{row.referralCode}</TableCell>
                  <TableCell>
                    <span className="capitalize">{row.tierKey}</span>
                    <span className="text-xs text-muted-foreground"> · {row.qualifyingCustomers} paying</span>
                  </TableCell>
                  <TableCell>
                    <AdminStatus tone={row.status === "active" ? (row.payoutHoldReason ? "warning" : "success") : "danger"} label={row.status === "active" ? (row.payoutHoldReason ? "Payouts held" : "Active") : "Suspended"} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{when(row.approvedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableCard>
      )}
    </AdminPage>
  );
}
