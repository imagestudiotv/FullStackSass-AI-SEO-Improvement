import { Receipt } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRows } from "../empty-rows";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

import { listPayments } from "@/lib/admin/actions";
import { DATE_RANGES, pageFrom } from "@/lib/admin/shared";
import { FilterBar } from "../filter-bar";
import { Pagination } from "../pagination";
import { AdminSearch } from "../admin-search";
import { RefundButton } from "./refund-button";

export const metadata = { title: "Payments" };

// Reads live payment state, so it can never be prerendered.
export const dynamic = "force-dynamic";

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Every payment, with a refund control.
 *
 * Support's most common money question is "can you refund this", and until
 * now the answer meant opening Stripe, finding the charge, refunding it, and
 * then correcting the local record by hand. Two systems, no record of who did
 * it.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  /** Set when arriving from a workspace, to see one customer's payments. */
  const organizationId =
    typeof params.org === "string" ? params.org : undefined;

  const status = typeof params.status === "string" ? params.status : "all";
  const provider =
    typeof params.provider === "string" ? params.provider : "all";
  const paid = typeof params.paid === "string" ? params.paid : "all";

  const filtering = Boolean(
    search || status !== "all" || provider !== "all" || paid !== "all",
  );

  const page = pageFrom(params.page);
  const { rows, total, pageSize } = await listPayments({
    search,
    organizationId,
    page,
    status,
    provider,
    paid,
  });

  /**
   * Named from the rows rather than a second query. No rows means no
   * confirmed name, so the banner is hidden rather than guessing.
   */
  const filteredTo = organizationId ? rows[0]?.organizationName : undefined;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Payments"
        description="Every payment taken, newest first. Refunds go back through Stripe and are recorded in the admin log."
      />

      {filteredTo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Showing payments for</span>
          <span className="font-medium">{filteredTo}</span>
          <Link
            href="/admin/payments"
            className="ml-auto text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Show all customers
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <AdminSearch
          placeholder="Search customer or description"
          defaultValue={search}
          extraParams={organizationId ? { org: organizationId } : {}}
        />
        {/*
          The three questions actually asked of this page. Refunds were the
          hardest to answer: they sit among every successful payment, newest
          first, and a customer disputing one names a date rather than an id.
        */}
        <FilterBar
          basePath="/admin/payments"
          preserve={{ q: search || undefined, org: organizationId }}
          filters={[
            {
              param: "status",
              label: "Status",
              allValue: "all",
              options: [
                { value: "all", label: "Any" },
                { value: "paid", label: "Paid" },
                { value: "refunded", label: "Refunded" },
                { value: "failed", label: "Failed" },
              ],
            },
            {
              param: "provider",
              label: "Processor",
              allValue: "all",
              options: [
                { value: "all", label: "Any" },
                { value: "stripe", label: "Stripe" },
                { value: "paypal", label: "PayPal" },
              ],
            },
            {
              param: "paid",
              label: "Paid",
              allValue: "all",
              options: DATE_RANGES.map((range) => ({ ...range })),
            },
          ]}
        />
      </div>

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyRows
              filtering={filtering}
              icon={Receipt}
              noun="payments"
              emptyTitle="No payments yet"
              emptyDescription="Payments appear here as soon as the first subscription or add-on is paid for."
            />
          ) : (
            <Table minWidth="48rem">
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="hidden md:table-cell">For</TableHead>
                  <TableHead className="w-28">Amount</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">
                    Paid
                  </TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const amount = money(row.amountCents, row.currency);
                  const name = row.organizationName ?? "Unknown workspace";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-48 truncate font-medium">
                        <Link
                          href={`/admin/payments?org=${row.organizationId}`}
                          className="hover:underline"
                        >
                          {name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                        {row.description ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">{amount}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={row.status}
                          // A payment record states what happened; "Needs
                          // attention" would read as a task for the operator.
                          label={row.status === "failed" ? "Failed" : undefined}
                        />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {row.paidAt.toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell>
                        {/*
                          Offered only where it would work. PayPal refunds run
                          through a different capture flow, and a button that
                          always fails is worse than no button.
                        */}
                        {row.status === "paid" && row.provider === "stripe" ? (
                          <RefundButton
                            paymentId={row.id}
                            amountLabel={amount}
                            organizationName={name}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        params={{
          q: search || undefined,
          org: organizationId,
          status: status !== "all" ? status : undefined,
          provider: provider !== "all" ? provider : undefined,
          paid: paid !== "all" ? paid : undefined,
        }}
        basePath="/admin/payments"
      />
    </PageShell>
  );
}
