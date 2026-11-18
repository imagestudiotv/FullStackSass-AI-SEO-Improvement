"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import type { PayPalPendingCopy } from "@/lib/i18n/paypal-pending";
import { confirmPayPalReturn } from "@/lib/paypal/actions";

/**
 * Shown beside the payment buttons when paying another way - by card, or
 * another plan - was refused because a PayPal payment for this website was
 * started and never finished (beginCheckout, code "paypal_pending"). A
 * customer who changed their mind used to get only an error, and the way out
 * (PayPalPendingNotice) appeared at the top of the page ten minutes later.
 *
 * One click cancels it - the same release as PayPal's "Cancel and return"
 * (confirmPayPalReturn "cancelled"), which lets go only of an approval PayPal
 * still reports unapproved - and then carries on with what the customer
 * clicked (`onContinue`). If PayPal says it was paid after all, that is said
 * instead and the page refreshes to show the plan.
 */
export function PayPalPendingPrompt({
  websiteId,
  copy,
  onContinue,
  failed = false,
  className,
}: {
  websiteId: string;
  copy: PayPalPendingCopy;
  /** Repeats what the customer clicked, now that the PayPal payment is out of the way. */
  onContinue: () => void;
  /** The repeat was refused again: PayPal has not let go of it yet. */
  failed?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<"paid" | "failed" | null>(null);

  function cancelAndContinue() {
    start(async () => {
      const result = await confirmPayPalReturn(websiteId, "cancelled").catch(() => null);
      if (!result) {
        setOutcome("failed");
        return;
      }
      if (result.paid) {
        setOutcome("paid");
        router.refresh();
        return;
      }
      setOutcome(null);
      onContinue();
    });
  }

  if (outcome === "paid") {
    return (
      <Notice tone="success" role="status" className={className}>
        {copy.paid}
      </Notice>
    );
  }
  return (
    <Notice
      tone="warning"
      title={copy.title}
      role="alert"
      className={className}
      action={
        <Button type="button" size="sm" variant="outline" onClick={cancelAndContinue} disabled={pending}>
          {pending ? copy.cancelling : copy.cancelAndContinue}
        </Button>
      }
    >
      <p>{copy.promptBody}</p>
      {failed || outcome === "failed" ? <p className="mt-1 font-medium">{copy.failed}</p> : null}
    </Notice>
  );
}
