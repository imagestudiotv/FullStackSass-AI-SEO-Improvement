"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { refundPayment } from "@/lib/admin/operations";

/**
 * Refunding a payment.
 *
 * Behind a dialog that states the amount and demands a reason, because a
 * Stripe refund cannot be undone and this button sits in a table row next to
 * a hundred others. A single click on the wrong line would send real money.
 *
 * The reason is required rather than optional: it is what the audit log shows
 * the next person who asks why this customer was refunded.
 */
export function RefundButton({
  paymentId,
  amountLabel,
  organizationName,
}: {
  paymentId: string;
  /** Formatted amount, so the dialog states exactly what will be sent back. */
  amountLabel: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await refundPayment(paymentId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Refunded ${amountLabel}`);
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
          <DialogTitle>Refund {amountLabel}?</DialogTitle>
          <DialogDescription>
            This sends {amountLabel} back to {organizationName} through Stripe.
            It cannot be undone, and it does not cancel their subscription.
          </DialogDescription>
        </DialogHeader>

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
            disabled={pending || reason.trim().length < 3}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Refund {amountLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
