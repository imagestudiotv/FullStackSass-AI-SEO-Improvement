"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteRefund, refundPayment } from "@/lib/admin/operations";

/**
 * Refunding a payment.
 *
 * Behind a dialog that states the amount and demands a reason, because a
 * Stripe refund cannot be undone and this button sits in a table row next to
 * a hundred others. A single click on the wrong line would send real money.
 *
 * The amount is suggested from what the customer has actually used — the
 * fraction of their articles still unwritten — rather than defaulting to the
 * whole payment. Someone who generated most of their allowance and then asked
 * for their money back has had most of what they paid for.
 *
 * It stays editable. The suggestion is a starting point, not a policy: a
 * goodwill refund of the full amount and a strict prorated one are both
 * legitimate, and the operator is the one holding the context.
 */

type Quote = {
  fullCents: number;
  suggestedCents: number;
  articlesUsed: number;
  articleLimit: number;
  currency: string;
};

export function RefundButton({
  paymentId,
  amountLabel,
  organizationName,
}: {
  paymentId: string;
  /** Formatted full amount, for the trigger and the fallback wording. */
  amountLabel: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [cancelSub, setCancelSub] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Usage is read when the dialog opens rather than rendered with the table.
   * Quoting every row would mean a usage query per payment on a page that
   * exists mostly to be read.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void quoteRefund(paymentId).then((result) => {
      if (cancelled || !result.ok) return;
      setQuote(result.data);
      setAmount((result.data.suggestedCents / 100).toFixed(2));
    });
    return () => {
      cancelled = true;
    };
  }, [open, paymentId]);

  const cents = Math.round(Number(amount) * 100);
  const amountValid =
    Number.isFinite(cents) &&
    cents > 0 &&
    (!quote || cents <= quote.fullCents);
  const reasonValid = reason.trim().length >= 3;

  function submit() {
    startTransition(async () => {
      const result = await refundPayment(paymentId, reason, {
        amountCents: cents,
        cancelSubscription: cancelSub,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Refunded ${(result.data.refunded / 100).toFixed(2)}${
          result.data.cancelled ? " and cancelled the subscription" : ""
        }`,
      );
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="size-3.5" aria-hidden="true" />
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund {organizationName}</DialogTitle>
          <DialogDescription>
            {quote ? (
              <>
                They have used {quote.articlesUsed} of {quote.articleLimit}{" "}
                articles this period, so {(quote.suggestedCents / 100).toFixed(2)}{" "}
                of {amountLabel} is unused. Change the amount if a different one
                is right.
              </>
            ) : (
              <>Checking how much of this period they have used…</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Amount to refund</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {quote ? (
              <div className="flex flex-wrap gap-3 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() =>
                    setAmount((quote.suggestedCents / 100).toFixed(2))
                  }
                >
                  Unused ({(quote.suggestedCents / 100).toFixed(2)})
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setAmount((quote.fullCents / 100).toFixed(2))}
                >
                  Full amount ({(quote.fullCents / 100).toFixed(2)})
                </button>
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={cancelSub}
              onChange={(event) => setCancelSub(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              Cancel their subscription too
              <span className="block text-xs text-muted-foreground">
                Stops article generation and publishing. Leave unticked for a
                goodwill refund to a customer who is staying.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Why is this being refunded?</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer asked within the guarantee period"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Recorded against your name in the admin log.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            // Guarded here as well as on the server, so the obvious mistake is
            // caught before a round trip.
            disabled={pending || !amountValid || !reasonValid}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
