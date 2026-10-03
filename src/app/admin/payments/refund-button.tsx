"use client";

import { AlertTriangle, Loader2, MoreHorizontal, RotateCw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteRefund, refundPayment } from "@/lib/admin/operations";
import { cn } from "@/lib/utils";

import { formatMoney } from "./money";

/**
 * A payment row's actions, and the refund dialog behind them.
 *
 * Refunding sits in the row's "More" menu, behind a dialog that states the
 * payment and demands a reason, because a Stripe refund cannot be undone and
 * this row sits in a table next to a hundred others. A single click on the
 * wrong line would send real money.
 *
 * The amount is suggested from what the customer has actually used - the
 * fraction of their articles still unwritten - rather than defaulting to the
 * whole payment. Someone who generated most of their allowance and then asked
 * for their money back has had most of what they paid for.
 *
 * It stays editable. The suggestion is a starting point, not a policy: a
 * goodwill refund of the full amount and a strict prorated one are both
 * legitimate, and the operator is the one holding the context.
 *
 * Only display facts reach this component (id, name, amount, date, what it
 * was for). The processor's own id and the invoice link stay on the server,
 * and the server re-reads the payment and decides everything again.
 */

type Quote = {
  fullCents: number;
  suggestedCents: number;
  articlesUsed: number;
  articleLimit: number;
  currency: string;
};

type QuoteState =
  | { status: "loading" }
  | { status: "ready"; quote: Quote }
  | { status: "failed"; error: string };

type RefundInput = {
  amountCents: number;
  cancelSubscription: boolean;
  reason: string;
};

export function PaymentActions({
  paymentId,
  organizationName,
  amountCents,
  currency,
  amountLabel,
  paidLabel,
  description,
  refundBlockedReason,
}: {
  paymentId: string;
  organizationName: string;
  /** What was paid, in cents, as stored. */
  amountCents: number;
  currency: string;
  /** Formatted full amount, for the menu label and the fallback wording. */
  amountLabel: string;
  /** Formatted payment date. */
  paidLabel: string;
  description: string | null;
  /**
   * Why this payment cannot be refunded here (e.g. a PayPal payment), or null
   * when it can. Mirrors the server's own refusal, so nothing is offered that
   * the server would refuse for that reason.
   */
  refundBlockedReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function refund(input: RefundInput) {
    startTransition(async () => {
      const result = await refundPayment(paymentId, input.reason, {
        amountCents: input.amountCents,
        cancelSubscription: input.cancelSubscription,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Refunded ${formatMoney(result.data.refunded, currency)}${
          result.data.cancelled ? " and cancelled the subscription" : ""
        }`,
      );
      if (input.cancelSubscription && !result.data.cancelled) {
        // The money is back, but Stripe did not confirm the cancellation: it must be done by hand.
        toast.warning(
          "The refund went through, but the subscription was not cancelled. Cancel it in the Stripe dashboard.",
          { duration: 15_000 },
        );
      }
      if (result.data.referralReversalFailed) {
        // The referrer still holds this customer's referral reward; take it back with a credit adjustment.
        toast.error(
          "The referral reward for this customer could not be reversed. Adjust the referrer's credits by hand.",
          { duration: 15_000 },
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${organizationName}, ${amountLabel} on ${paidLabel}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {refundBlockedReason ? (
            /*
              Reachable, not disabled: a disabled menu item is skipped by the
              arrow keys, so its reason was never heard. It carries the reason
              in its own text and does nothing when chosen.
            */
            <DropdownMenuItem
              aria-disabled="true"
              className="flex-col items-start gap-0.5 opacity-70"
              onSelect={(event) => event.preventDefault()}
            >
              <span className="flex items-center gap-2">
                <Undo2 className="size-4" aria-hidden="true" />
                Refund unavailable
              </span>
              <span className="text-xs text-muted-foreground">{refundBlockedReason}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
              <Undo2 className="size-4" aria-hidden="true" />
              Refund…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={open}
        // Kept open while the refund is in flight, so its outcome is seen.
        onOpenChange={(next) => {
          if (!next && pending) return;
          setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            // Back to the row's menu button rather than the top of the page.
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          {/* Mounted per opening: every refund starts from a fresh quote and an empty form. */}
          <RefundForm
            paymentId={paymentId}
            organizationName={organizationName}
            amountCents={amountCents}
            currency={currency}
            amountLabel={amountLabel}
            paidLabel={paidLabel}
            description={description}
            pending={pending}
            onCancel={() => setOpen(false)}
            onSubmit={refund}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefundForm({
  paymentId,
  organizationName,
  amountCents,
  currency,
  amountLabel,
  paidLabel,
  description,
  pending,
  onCancel,
  onSubmit,
}: {
  paymentId: string;
  organizationName: string;
  amountCents: number;
  currency: string;
  amountLabel: string;
  paidLabel: string;
  description: string | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: RefundInput) => void;
}) {
  const [quote, setQuote] = useState<QuoteState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [amount, setAmount] = useState("");
  /** No default: refunding and cancelling are separate decisions, made each time. */
  const [subscription, setSubscription] = useState<"keep" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const amountHelpId = useId();
  const reasonHelpId = useId();

  /**
   * Usage is read when the dialog opens rather than rendered with the table.
   * Quoting every row would mean a usage query per payment on a page that
   * exists mostly to be read. A failed check says so and can be retried; the
   * amount can always be entered by hand.
   */
  useEffect(() => {
    let cancelled = false;
    quoteRefund(paymentId).then(
      (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setQuote({ status: "failed", error: result.error });
          return;
        }
        setQuote({ status: "ready", quote: result.data });
        const suggested = (result.data.suggestedCents / 100).toFixed(2);
        // Fill the suggestion unless the operator has already typed an amount.
        setAmount((current) => (current === "" ? suggested : current));
      },
      () => {
        if (!cancelled) setQuote({ status: "failed", error: "The usage check did not answer." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [paymentId, attempt]);

  const money = (cents: number) => formatMoney(cents, currency);
  const fullCents = quote.status === "ready" ? quote.quote.fullCents : amountCents;

  const cents = Math.round(Number(amount) * 100);
  const amountValid = Number.isFinite(cents) && cents > 0 && cents <= fullCents;
  const amountError =
    amount.trim() === "" || amountValid
      ? null
      : Number.isFinite(cents) && cents > fullCents
        ? `That is more than the customer paid (${money(fullCents)}).`
        : "Enter an amount greater than zero.";
  const partial = amountValid && cents < fullCents;
  const reasonValid = reason.trim().length >= 3;
  const chosen = subscription !== null;
  const ready = amountValid && reasonValid && chosen;

  const missing = [
    amountValid ? null : amount.trim() === "" ? "enter an amount" : "correct the amount",
    chosen ? null : "choose what happens to the subscription",
    reasonValid ? null : "give a reason",
  ].filter((step): step is string => step !== null);

  function submit() {
    if (!ready || pending) return;
    onSubmit({ amountCents: cents, cancelSubscription: subscription === "cancel", reason });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8 leading-snug wrap-anywhere">Refund {organizationName}</DialogTitle>
        <DialogDescription>
          Sends money back to the customer through Stripe. A refund cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
        <dt className="text-muted-foreground">Paid</dt>
        <dd className="font-medium tabular-nums">{amountLabel}</dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd className="tabular-nums">{paidLabel}</dd>
        <dt className="text-muted-foreground">For</dt>
        <dd className="wrap-anywhere">{description ?? "-"}</dd>
      </dl>

      <div role="status" aria-live="polite" className="text-sm">
        {quote.status === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Checking how much of this period they have used…
          </p>
        ) : quote.status === "failed" ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0 space-y-1.5">
              <p className="wrap-anywhere">
                Could not check how much of this period they have used ({quote.error}). Enter the amount
                to refund yourself.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setQuote({ status: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
                Check again
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            {quote.quote.articleLimit > 0 ? (
              <>
                They have used{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {quote.quote.articlesUsed.toLocaleString("en-GB")} of{" "}
                  {quote.quote.articleLimit.toLocaleString("en-GB")}
                </span>{" "}
                articles this period, so{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {money(quote.quote.suggestedCents)}
                </span>{" "}
                of {amountLabel} is unused.
              </>
            ) : (
              <>
                There is no article allowance to prorate against (an unlimited plan, or no
                subscription found for this payment), so the full{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {money(quote.quote.suggestedCents)}
                </span>{" "}
                is suggested.
              </>
            )}{" "}
            Change the amount if a different one is right.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${paymentId}-refund-amount`}>Amount to refund</Label>
          <div className="relative">
            <Input
              id={`${paymentId}-refund-amount`}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={pending}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountHelpId}
              className="h-9 pr-14 tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
              {currency.toUpperCase()}
            </span>
          </div>
          <div id={amountHelpId} className="space-y-1.5 text-xs">
            {amountError ? <p className="text-danger">{amountError}</p> : null}
            {partial ? (
              <p className="text-muted-foreground">
                Partial refund. The payment is still marked refunded, so it cannot be refunded again
                here; the amount is kept in the admin log.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {quote.status === "ready" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setAmount((quote.quote.suggestedCents / 100).toFixed(2))}
                className="tabular-nums"
              >
                Unused ({money(quote.quote.suggestedCents)})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setAmount((fullCents / 100).toFixed(2))}
              className="tabular-nums"
            >
              Full amount ({money(fullCents)})
            </Button>
          </div>
        </div>

        <fieldset className="space-y-2" disabled={pending}>
          <legend className="text-sm font-medium">Their subscription</legend>
          <div className="grid gap-2 pt-1">
            <SubscriptionChoice
              name={`${paymentId}-subscription`}
              value="keep"
              checked={subscription === "keep"}
              onChange={() => setSubscription("keep")}
              title="Keep it running"
              detail="A goodwill refund to a customer who is staying."
            />
            <SubscriptionChoice
              name={`${paymentId}-subscription`}
              value="cancel"
              checked={subscription === "cancel"}
              onChange={() => setSubscription("cancel")}
              title="Cancel it too"
              detail="Cancelled in Stripe after the refund; stops article generation and publishing. If this payment's subscription cannot be identified (a one-off add-on has none), nothing is refunded."
            />
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor={`${paymentId}-refund-reason`}>Why is this being refunded?</Label>
          <Input
            id={`${paymentId}-refund-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Customer asked within the guarantee period"
            autoComplete="off"
            disabled={pending}
            aria-describedby={reasonHelpId}
            className="h-9"
          />
          <p id={reasonHelpId} className="text-xs text-muted-foreground">
            Recorded against your name in the admin log. At least 3 characters.
          </p>
        </div>
      </div>

      {!pending && missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">To refund, {joinSteps(missing)}.</p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={submit}
          // Guarded here as well as on the server, so the obvious mistake is
          // caught before a round trip. Disabled while pending: it is the only
          // guard against a double submit.
          disabled={pending || !ready}
          className="tabular-nums"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Undo2 className="size-4" aria-hidden="true" />
          )}
          {pending ? "Refunding…" : amountValid ? `Refund ${money(cents)}` : "Refund"}
        </Button>
      </DialogFooter>
    </>
  );
}

function SubscriptionChoice({
  name,
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none",
        "hover:bg-muted/40 has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-60",
        checked && "border-primary/50 bg-primary/5",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

/** "a", "a and b", "a, b and c" - with the first letter as written. */
function joinSteps(steps: string[]): string {
  if (steps.length <= 1) return steps.join("");
  return `${steps.slice(0, -1).join(", ")} and ${steps[steps.length - 1]}`;
}
