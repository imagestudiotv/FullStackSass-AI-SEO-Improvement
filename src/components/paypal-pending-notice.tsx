"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import type { PayPalPendingCopy } from "@/lib/i18n/paypal-pending";
import { confirmPayPalReturn } from "@/lib/paypal/actions";

/**
 * A PayPal payment started for this website and never finished - the
 * customer closed PayPal's tab instead of paying or pressing "Cancel and
 * return" - and a way out (review H1, 2026-10-20). Until it is cancelled the
 * website cannot be paid by card or change plan (lib/billing/checkouts.ts
 * beginCheckout).
 *
 * Cancelling is what PayPal's "Cancel and return" does
 * (confirmPayPalReturn "cancelled"): only an approval PayPal still reports
 * unapproved is released, one it reports paid is recorded instead, and one
 * approved later anyway is cancelled by the sync if the website pays some
 * other way by then.
 */
export function PayPalPendingNotice({ websiteId, copy }: { websiteId: string; copy: PayPalPendingCopy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<"cancelled" | "paid" | "failed" | null>(null);

  function cancel() {
    start(async () => {
      const result = await confirmPayPalReturn(websiteId, "cancelled").catch(() => null);
      setOutcome(!result || !result.changed ? "failed" : result.paid ? "paid" : "cancelled");
      router.refresh();
    });
  }

  if (outcome === "cancelled" || outcome === "paid") {
    return (
      <Notice tone="success" role="status">
        {copy[outcome]}
      </Notice>
    );
  }
  return (
    <Notice
      tone="warning"
      title={copy.title}
      role={outcome === "failed" ? "alert" : undefined}
      action={
        <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={pending}>
          {pending ? copy.cancelling : copy.cancel}
        </Button>
      }
    >
      <p>{copy.body}</p>
      {outcome === "failed" ? <p className="mt-1 font-medium">{copy.failed}</p> : null}
    </Notice>
  );
}
