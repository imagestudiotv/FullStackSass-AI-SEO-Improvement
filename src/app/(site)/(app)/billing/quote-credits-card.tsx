"use client";

import { ArrowLeft, Coins, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PayPalMark } from "@/components/paypal-mark";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { buyQuoteCredits } from "@/lib/credits/quote-topup-actions";
import { projectAnchor, type QuoteTopUpCheck } from "@/lib/credits/quote-topup-shared";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { creditsIn, type QuoteCreditsCopy } from "@/lib/i18n/quote-credits";
import { WEBSITE_PROJECTS_PATH } from "@/lib/website-projects/shared";

import { formatMoney } from "./billing-view";

/**
 * Credits for a quote, at the top of Billing when "Buy credits" on a quote
 * brought the customer here (lib/credits/quote-topup.ts). Everything on it -
 * the quote's price, the balance, the shortfall and its price - was worked out
 * on the server; the buttons send back only which quote and what was shown,
 * and the server checks both again.
 */
export function QuoteCreditsCard({
  check,
  projectId,
  kindLabel,
  copy,
  locale,
  paypalAvailable,
}: {
  check: QuoteTopUpCheck;
  projectId: string;
  /** The project's kind, in the reader's language ("New website"). */
  kindLabel: string | null;
  copy: QuoteCreditsCopy;
  locale: Locale;
  paypalAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"stripe" | "paypal" | null>(null);
  const back = `${WEBSITE_PROJECTS_PATH}#${projectAnchor(projectId)}`;
  const backLink = (
    <Button size="sm" variant="outline" asChild>
      <Link href={back}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {copy.backToQuote}
      </Link>
    </Button>
  );

  if (!check.ok) {
    return (
      <WorkspaceSection id="quote-credits" icon={Coins} title={copy.title}>
        <Notice tone={check.reason === "covered" ? "success" : "info"} action={backLink}>
          {copy.refusal[check.reason]}
        </Notice>
      </WorkspaceSection>
    );
  }

  const offer = check.offer;
  const credits = (count: number) => creditsIn(copy, count, locale);
  const money = (cents: number) => formatMoney(cents, offer.currency, locale);
  const price = money(offer.priceCents);
  const perCredit = money(Math.round(offer.rate.priceCents / offer.rate.credits));

  async function buy(provider: "stripe" | "paypal") {
    setPending(provider);
    try {
      const result = await buyQuoteCredits({
        projectId: offer.projectId,
        revision: offer.revision,
        expectedCredits: offer.credits,
        expectedPriceCents: offer.priceCents,
        provider,
      });
      if (!result.ok) {
        toast.error(result.error);
        setPending(null);
        // The balance, the quote or the price moved on: show what is true now.
        if (result.reason !== "provider") router.refresh();
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error(copy.checkoutFailed);
      setPending(null);
    }
  }

  return (
    <WorkspaceSection
      id="quote-credits"
      icon={Coins}
      title={copy.title}
      description={format(copy.intro, { kind: kindLabel ?? "" })}
      className="scroll-mt-20 border-primary/40"
    >
      <div className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label={copy.required} value={credits(offer.quoteCredits)} />
          <Figure label={copy.balance} value={credits(offer.available)} />
          <Figure label={copy.shortfall} value={credits(offer.credits)} strong />
          <Figure label={copy.price} value={price} strong />
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          {format(copy.rateNote, { rate: perCredit, pack: `${credits(offer.rate.credits)} · ${money(offer.rate.priceCents)}` })}{" "}
          {copy.terms}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button className="h-auto min-h-9 whitespace-normal" disabled={pending !== null} onClick={() => buy("stripe")}>
            {pending === "stripe" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {format(copy.payByCard, { credits: credits(offer.credits), price })}
          </Button>
          {paypalAvailable ? (
            <Button variant="outline" className="h-auto min-h-9 whitespace-normal" disabled={pending !== null} onClick={() => buy("paypal")}>
              {pending === "paypal" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <PayPalMark className="size-5" />
              )}
              {copy.payWithPayPal}
            </Button>
          ) : null}
          <Button variant="ghost" asChild className="sm:ml-auto">
            <Link href={back}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {copy.backToQuote}
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{copy.notPaidYet}</p>
      </div>
    </WorkspaceSection>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "mt-1 text-xl font-semibold tabular-nums text-foreground" : "mt-1 text-xl tabular-nums text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
