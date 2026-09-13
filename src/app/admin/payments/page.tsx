import { Receipt } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPayments } from "@/lib/admin/actions";
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
export default async function AdminPaymentsPage() {
  const rows = await listPayments();

  return (
    <PageShell width="wide">
      <PageHeader
        title="Payments"
        description="Every payment taken, newest first. Refunds go back through Stripe and are recorded in the admin log."
      />

      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payments yet"
              description="Payments appear here as soon as the first subscription or add-on is paid for."
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
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                        {row.description ?? "—"}
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
    </PageShell>
  );
}
