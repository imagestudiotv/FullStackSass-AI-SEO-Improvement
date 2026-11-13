import { Download, Receipt } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceSection } from "@/components/workspace/section";
import type { PaymentRow } from "@/lib/billing";
import { isNoCharge } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { formatMoney, lacksCardInvoice, type InvoicePortal } from "./billing-view";
import { ManageBillingButton } from "./manage-billing-button";

/** listPayments() returns at most this many rows (LIMIT 24 in lib/billing.ts). */
const PAYMENTS_SHOWN = 24;

/**
 * Billing history: every subscription payment the webhooks recorded.
 *
 * Stripe's hosted invoice stays the authoritative document and is linked
 * where the webhook gave us a URL. PayPal sends none, so those rows point at
 * PayPal; a card payment without a URL points at Manage billing, where Stripe
 * keeps every invoice - it used to say "Receipt in PayPal" for a card payment.
 *
 * A refunded payment says so: it looked exactly like a normal payment.
 */
export function PaymentsPanel({
  payments,
  portal,
  t,
  tBilling,
  tStatus,
  locale,
}: {
  payments: PaymentRow[];
  /** Where "Manage billing" is for card invoices without a link. */
  portal: InvoicePortal;
  /** Shared words: the panel's title, invoice and status words. */
  t: Messages["app"]["common"];
  /** The billing page's own words. */
  tBilling: Messages["app"]["billing"];
  /** The status vocabulary, for Paid and Refunded. */
  tStatus: Messages["app"]["status"];
  /** For the payment dates and amounts. */
  locale: Locale;
}) {
  // Nothing charged yet is the normal state for a new workspace, not an
  // error, so the section simply does not appear.
  if (payments.length === 0) return null;

  const offerPortal = portal === "here" && payments.some(lacksCardInvoice);

  return (
    <WorkspaceSection
      id="history"
      icon={Receipt}
      title={t.billingHistory}
      description={t.billingHistoryHelp}
      actions={
        offerPortal ? (
          <ManageBillingButton label={t.manageBilling} opening={tBilling.opening} failed={tBilling.portalFailed} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border">
          <Table minWidth="40rem">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 text-xs text-muted-foreground">{tBilling.dateColumn}</TableHead>
                <TableHead className="text-xs text-muted-foreground">{tBilling.descriptionColumn}</TableHead>
                <TableHead className="text-xs text-muted-foreground">{tBilling.methodColumn}</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">{tBilling.amountColumn}</TableHead>
                <TableHead className="text-xs text-muted-foreground">{tBilling.status}</TableHead>
                <TableHead className="px-4 text-xs text-muted-foreground">{tBilling.receiptColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="px-4 tabular-nums">
                    {/* Stored timestamps in UTC, as on the rest of the page. */}
                    {formatDate(payment.paidAt, locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={payment.description ?? undefined}>
                    {payment.description ?? "—"}
                  </TableCell>
                  <TableCell>{payment.provider === "paypal" ? "PayPal" : tBilling.paidByCard}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(payment.amountCents, payment.currency, locale)}
                  </TableCell>
                  <TableCell>
                    {payment.status === "failed" ? (
                      <StatusBadge status="failed" label={t.failed} />
                    ) : payment.status === "refunded" ? (
                      <StatusBadge status="refunded" t={tStatus} />
                    ) : isNoCharge(payment) ? (
                      // A free trial's zero invoice: nothing was taken.
                      <StatusBadge status="paid" label={t.noCharge} tone="neutral" />
                    ) : (
                      <StatusBadge status={payment.status} t={tStatus} />
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {payment.invoiceUrl ? (
                      <a
                        href={payment.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        {t.invoice}
                        <span className="sr-only">{tBilling.newTab}</span>
                      </a>
                    ) : payment.provider === "paypal" ? (
                      <span className="text-xs text-muted-foreground">{t.receiptInPayPal}</span>
                    ) : portal !== "none" ? (
                      <span className="text-xs text-muted-foreground">{tBilling.invoiceInPortal}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {payments.length >= PAYMENTS_SHOWN ? (
          <p className="text-xs text-muted-foreground">{format(tBilling.historyCapped, { count: PAYMENTS_SHOWN })}</p>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
