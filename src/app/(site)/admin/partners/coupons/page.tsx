import { TicketPercent } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { pageFrom } from "@/lib/admin/shared";
import { adminCoupons } from "@/lib/partners/application/queries/admin-reports";
import { deactivatePartnerCouponAction } from "@/lib/partners/presentation/admin-actions";
import { rateLabel } from "@/lib/partners/presentation/format";
import { partnerDeps } from "@/lib/partners/server";

import { AdminPage, AdminPageHeader } from "../../_ui/page";
import { AdminEmpty, AdminUnavailable } from "../../_ui/states";
import { AdminStatus, type StatusTone } from "../../_ui/status";
import { AdminTableCard } from "../../_ui/table";
import { AdminToolbar } from "../../_ui/toolbar";
import { Pagination } from "../../pagination";
import { money, when } from "../_ui/labels";
import { ReasonAction } from "../_ui/reason-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner coupons" };

const STATUS: Record<string, [StatusTone, string]> = {
  creating: ["pending", "Scheduled"],
  active: ["success", "Active"],
  inactive: ["neutral", "Inactive"],
  failed: ["danger", "Stripe refused"],
};

/**
 * Admin -> Partner coupons: every partner coupon and campaign, created from
 * a partner's page. A coupon attributes a new customer only when no partner
 * link applies, the account is newly eligible, has never paid, and the
 * first checkout is within the coupon window.
 */
export default async function PartnerCouponsPage({ searchParams }: PageProps<"/admin/partners/coupons">) {
  const who = await requireAdmin();
  const params = await searchParams;
  const search = typeof params.q === "string" && params.q.trim() ? params.q.trim() : undefined;
  const result = await adminCoupons(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, { search, page: pageFrom(params.page) });

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Partner coupons"
        description="Coupons and campaigns assigned to partners. Create one from the partner's page; partners see only their own active codes."
        back={{ href: "/admin/partners", label: "Affiliate program" }}
      />
      {!result.environment ? (
        <AdminUnavailable title="Stripe is not configured" description="Coupons live in Stripe. Set STRIPE_SECRET_KEY to manage them." />
      ) : (
        <>
          <AdminToolbar searchPlaceholder="Search code or campaign" searchLabel="Search coupons" resultLabel={`${result.total} coupon${result.total === 1 ? "" : "s"} (${result.environment})`} />
          {result.rows.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <AdminEmpty filtering={Boolean(search)} icon={TicketPercent} noun="coupons" title="No coupons yet" description="Open a partner and use Create coupon." clearHref="/admin/partners/coupons" action={<Link className="text-sm underline underline-offset-4" href="/admin/partners/partners">Partners</Link>} />
            </div>
          ) : (
            <AdminTableCard footer={<Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/admin/partners/coupons" params={{ q: search }} />}>
              <Table minWidth="900px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => {
                    const [tone, label] = STATUS[row.status] ?? ["neutral", row.status];
                    return (
                      <TableRow key={row.id}>
                        <TableCell data-align="top">
                          <span className="font-mono font-medium">{row.code}</span>
                          <p className="text-xs text-muted-foreground">{row.campaign}</p>
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
                        <TableCell data-align="top">
                          {row.percentOffBasisPoints !== null ? rateLabel(row.percentOffBasisPoints) : money(row.amountOff, row.currency)}
                          <p className="text-xs text-muted-foreground">
                            {row.duration === "repeating" ? `${row.durationInMonths} months` : row.duration === "once" ? "first payment" : "every payment"}
                            {row.maxRedemptions ? ` · max ${row.maxRedemptions}` : ""}
                          </p>
                        </TableCell>
                        <TableCell data-align="top" className="text-xs">
                          {row.startsAt ? `from ${when(row.startsAt, false)}` : "from creation"}
                          <br />
                          {row.expiresAt ? `until ${when(row.expiresAt, false)}` : "no end date"}
                        </TableCell>
                        <TableCell data-align="top">
                          <AdminStatus tone={tone} label={label} />
                        </TableCell>
                        <TableCell data-align="top">
                          {row.status === "active" || row.status === "creating" ? (
                            <ReasonAction
                              action={deactivatePartnerCouponAction.bind(null, row.id)}
                              label="Deactivate…"
                              title={`Deactivate ${row.code}?`}
                              description="The promotion code stops working at Stripe for new checkouts. Customers already attributed stay attributed."
                              confirmLabel="Deactivate"
                              success="Coupon deactivated"
                              tone="danger"
                            />
                          ) : null}
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
