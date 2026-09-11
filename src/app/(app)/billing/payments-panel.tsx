import { Download, Receipt } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/billing-shared";
import type { PaymentRow } from "@/lib/billing";

/**
 * Billing history.
 *
 * The brief asks for an invoice page. Stripe customers could already reach
 * theirs through the customer portal; PayPal subscribers could not, because
 * PayPal has no portal API we can open on their behalf. This gives both the
 * same in-app record.
 *
 * Stripe's hosted invoice remains the authoritative document and is linked
 * where the webhook gave us a URL. PayPal sends no equivalent, so those rows
 * show amount and date and point at PayPal for the receipt — accurate about
 * what we can and cannot hand over.
 */
export function PaymentsPanel({ payments }: { payments: PaymentRow[] }) {
  // Nothing charged yet is the normal state for a new workspace, not an
  // error, so the panel simply does not appear.
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4" aria-hidden="true" />
          Billing history
        </CardTitle>
        <CardDescription>
          Every subscription payment on this workspace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="divide-y rounded-xl border">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatPrice(payment.amountCents, payment.currency)}
                  {payment.status === "failed" ? (
                    <Badge variant="destructive" className="ml-2">
                      Failed
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payment.paidAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  <span className="mx-1.5">·</span>
                  {payment.provider === "paypal" ? "PayPal" : "Card"}
                  {payment.description ? (
                    <>
                      <span className="mx-1.5">·</span>
                      {payment.description}
                    </>
                  ) : null}
                </p>
              </div>

              {payment.invoiceUrl ? (
                <a
                  href={payment.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Invoice
                </a>
              ) : (
                /*
                  PayPal returns no invoice URL. Saying where the receipt lives
                  is more use than a dead link or a silent blank.
                */
                <span className="text-xs text-muted-foreground">
                  Receipt in PayPal
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
