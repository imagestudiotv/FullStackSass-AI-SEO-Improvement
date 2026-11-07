import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { formatPrice } from "@/lib/billing-shared";
import { formatDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { PayPalPlanChangeCopy } from "@/lib/i18n/paypal-plan-change";
import type { PlanChangeNotice } from "@/lib/paypal/plan-changes";

/**
 * A PayPal plan change under way for the selected website (review P1,
 * lib/paypal/plan-changes.ts), or what came of one on returning from PayPal.
 * Links only: every step is decided on the server, and PayPal's own pages
 * are where the buyer pays and approves.
 */
export function PayPalPlanChangeNotice({
  notice,
  result,
  copy,
  locale,
}: {
  notice: PlanChangeNotice | null;
  /** plan_change on the address after PayPal sent the buyer back. */
  result?: string;
  copy: PayPalPlanChangeCopy;
  locale: Locale;
}) {
  const plan = notice && "toPlanName" in notice ? (notice.toPlanName ?? "") : "";
  const link = (href: string | null, label: string) =>
    href?.startsWith("https://") ? (
      <a href={href} className={buttonVariants({ size: "sm", variant: "outline" })}>
        {label}
      </a>
    ) : null;

  const known = result && result in copy.result ? (result as keyof PayPalPlanChangeCopy["result"]) : null;
  const outcome = known ? (
    <Notice tone={known === "completed" ? "success" : known === "failed" ? "danger" : "info"} role="status">
      {copy.result[known]}
    </Notice>
  ) : null;

  if (!notice) return outcome;
  let body: ReactNode;
  switch (notice.kind) {
    case "pay":
      body = (
        <Notice tone="warning" title={copy.payTitle(plan)} action={link(notice.url, copy.payButton)}>
          <p>{copy.payBody(formatPrice(notice.differenceCents, notice.currency))}</p>
        </Notice>
      );
      break;
    case "approve":
      body = (
        <Notice tone="warning" title={copy.approveTitle(plan)} action={link(notice.url, copy.approveButton)}>
          <p>{notice.paid ? copy.approveBodyPaid : copy.approveBody}</p>
        </Notice>
      );
      break;
    case "scheduled":
      body = (
        <Notice tone="info">
          {copy.scheduled(plan, formatDate(notice.effectiveAt, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }))}
        </Notice>
      );
      break;
    case "refunding":
      body = <Notice tone="info">{copy.refunding(formatPrice(notice.differenceCents, notice.currency))}</Notice>;
      break;
  }
  return (
    <>
      {outcome}
      {body}
    </>
  );
}
