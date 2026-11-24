import { ShoppingBag } from "lucide-react";

import { formatMoney } from "@/app/(site)/(app)/billing/billing-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSection } from "@/components/workspace/section";
import type { PurchaseRow } from "@/lib/addons/shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

/** listPurchases() returns at most this many rows (LIMIT 25 in lib/addons/actions.ts). */
const PURCHASES_SHOWN = 25;

/** What this workspace has bought: on the credit packs' page and on Billing. Nothing while there is none. */
export function PurchasesPanel({
  purchases,
  locale,
  t,
  tCredits,
}: {
  purchases: PurchaseRow[];
  /** For prices and purchase dates in the reader's convention. */
  locale: Locale;
  t: Messages["app"]["addons"];
  tCredits: Pick<Messages["app"]["credits"], "creditsCount">;
}) {
  if (purchases.length === 0) return null;
  const credits = (count: number) => plural(tCredits.creditsCount, count);
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <WorkspaceSection id="purchases" icon={ShoppingBag} title={t.yourPurchases} bodyClassName="space-y-2">
      <ul className="divide-y rounded-lg border">
        {purchases.map((purchase) => (
          <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <ShoppingBag className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{purchase.name}</p>
                {/*
                  The account's language and UTC, as everywhere else:
                  toLocaleDateString() with no arguments followed the
                  browser and could disagree with the server's render.
                */}
                <p className="text-xs text-muted-foreground">
                  {formatDate(purchase.createdAt, locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                  <span aria-hidden="true"> · </span>
                  <span className="tabular-nums">
                    {purchase.creditsPaid ? credits(purchase.creditsPaid) : money(purchase.pricePaidCents, purchase.currency)}
                  </span>
                </p>
              </div>
            </div>
            {/*
              Credits are done the moment they are paid for; a manual
              service reads "in progress" until a person marks it
              delivered.
            */}
            {purchase.kind === "credits" ? (
              <StatusBadge status="fulfilled" label={t.added} />
            ) : purchase.status === "fulfilled" ? (
              <StatusBadge status="fulfilled" label={t.delivered} />
            ) : (
              <StatusBadge status="pending" label={t.inProgress} tone="active" animate={false} />
            )}
          </li>
        ))}
      </ul>
      {purchases.length >= PURCHASES_SHOWN ? (
        <p className="text-xs text-muted-foreground">{format(t.showingRecent, { count: PURCHASES_SHOWN })}</p>
      ) : null}
    </WorkspaceSection>
  );
}
