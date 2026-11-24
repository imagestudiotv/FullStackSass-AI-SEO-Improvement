"use client";

import { ArrowRight, Check, ChevronDown, Clock, CreditCard, Info, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PaymentMethodPicker, type PaymentMethod } from "@/components/billing/payment-method-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/workspace/notice";
import { buyAddon, buyAddonWithPayPal } from "@/lib/addons/actions";
import type { AddonRow } from "@/lib/addons/shared";
import { packViews, type PackView } from "@/lib/credits/buy-credits";
import type { BuyCreditsCopy, PaymentChoiceCopy } from "@/lib/i18n/buy-credits";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { formatMoney, withoutReturnParams } from "../../billing/billing-view";

/** Where a checkout came back from: the address's ?addon=. Anything else says nothing. */
export type AddonReturn = "success" | "pending" | "failed" | "cancelled";

/** The words for each return. "success" never claims the credits are there: the webhook grants them. */
export type AddonReturnCopy = Record<AddonReturn, string>;

/** How each pack can be paid: by card once it has a Stripe price, by PayPal when PayPal can complete a purchase here. */
export function packMethods(addon: AddonRow, paypalAvailable: boolean): PaymentMethod[] {
  return [
    ...(addon.purchasable ? (["card"] as const) : []),
    ...(paypalAvailable && addon.priceCents > 0 ? (["paypal"] as const) : []),
  ];
}

/**
 * The credit packs, first thing on the page (Daniel, 2026-11-24). The dialog
 * only asks how to pay: the price, the pack and the workspace are the
 * server's (lib/addons/actions.ts), and the credits come from the confirmed
 * payment, never from this page.
 */
export function CreditPacks({
  addons,
  paypalAvailable,
  result,
  resultCopy,
  copy,
  choice,
  locale,
  tAddons,
  mostPopular,
}: {
  addons: AddonRow[];
  paypalAvailable: boolean;
  /** Back from a checkout. */
  result: AddonReturn | null;
  resultCopy: AddonReturnCopy;
  copy: BuyCreditsCopy;
  choice: PaymentChoiceCopy;
  locale: Locale;
  tAddons: { perCredit: string; buyCredits: string; unavailable: string; checkoutFailed: string };
  mostPopular: string;
}) {
  const router = useRouter();
  const how = useRef<HTMLDetailsElement>(null);
  const [pack, setPack] = useState<AddonRow | null>(null);
  const [open, setOpen] = useState(false);
  // Kept from the first render: the address is cleaned below, and the page refreshes without it.
  const [returned] = useState(result);

  const { cards, topUp } = packViews(addons);

  // Once read, the return parameters leave the address, so a reload does not announce the same payment again.
  useEffect(() => {
    const clean = withoutReturnParams(window.location.href);
    if (clean) window.history.replaceState(null, "", clean);
  }, []);

  /*
    The payment provider sends the customer back before it has told us about
    the payment, so the balance on this page can be a few seconds behind:
    it is read again, twice.
  */
  useEffect(() => {
    if (returned !== "success" && returned !== "pending") return;
    const timers = [4_000, 12_000].map((ms) => window.setTimeout(() => router.refresh(), ms));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [returned, router]);

  function choose(addon: AddonRow) {
    setPack(addon);
    setOpen(true);
  }

  function showHow() {
    if (!how.current) return;
    how.current.open = true;
    how.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      {returned ? (
        <Notice role="status" tone={returned === "success" ? "success" : returned === "failed" ? "danger" : "info"}>
          {resultCopy[returned]}
        </Notice>
      ) : null}

      <section
        id="credit-packs"
        aria-labelledby="credit-packs-title"
        className="min-w-0 scroll-mt-20 rounded-2xl border bg-card p-5 sm:p-7 lg:p-9"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 id="credit-packs-title" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {copy.introTitle}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.introBody}</p>
          </div>
          <button
            type="button"
            onClick={showHow}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {copy.howLink}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-5 flex flex-wrap gap-2">
          {copy.benefits.map((benefit, index) => {
            const Icon = [Check, Clock, ShieldCheck][index];
            return (
              <li key={benefit} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {benefit}
              </li>
            );
          })}
        </ul>

        {cards.length > 0 ? (
          /* Three across from lg only: beside the md sidebar a third is too narrow for the button in most languages. */
          <div
            className={cn(
              "mt-8 grid items-stretch gap-5",
              cards.length >= 3 ? "lg:grid-cols-3" : cards.length === 2 ? "lg:grid-cols-2" : "max-w-md",
            )}
          >
            {cards.map((view, index) => (
              <PackCard
                key={view.addon.id}
                view={view}
                index={cards.length === 3 ? index : null}
                canPay={packMethods(view.addon, paypalAvailable).length > 0}
                paypalAvailable={paypalAvailable}
                copy={copy}
                locale={locale}
                tAddons={tAddons}
                mostPopular={mostPopular}
                onBuy={() => choose(view.addon)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">{copy.noPacks}</p>
        )}

        {topUp ? (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t pt-5 text-sm">
            <p className="flex min-w-0 items-start gap-2 text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {copy.topUpLead}{" "}
                <strong className="font-semibold text-foreground">
                  {format(copy.topUpOffer, {
                    credits: formatNumber(topUp.creditsGranted, locale),
                    price: formatMoney(topUp.priceCents, topUp.currency, locale),
                  })}
                </strong>
              </span>
            </p>
            <button
              type="button"
              onClick={() => choose(topUp)}
              className="inline-flex items-center gap-1 rounded-sm py-1 text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {format(copy.topUpButton, { credits: formatNumber(topUp.creditsGranted, locale) })}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {copy.trustSecure}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CreditCard className="size-4" aria-hidden="true" />
            {paypalAvailable ? copy.trustBoth : copy.trustCard}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" />
            {copy.trustNever}
          </li>
        </ul>
      </section>

      {/* A disclosure, so it needs no script and says whether it is open. */}
      <details ref={how} id="how-credits-work" className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{copy.howTitle}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{copy.howHelp}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <ol className="grid gap-5 border-t px-5 py-5 md:grid-cols-3">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 rounded-2xl p-6 sm:max-w-md" closeLabel={choice.close}>
          {pack ? (
            // Keyed by pack, so another pack starts from its own first method.
            <PackCheckout
              key={pack.id}
              pack={pack}
              methods={packMethods(pack, paypalAvailable)}
              copy={copy}
              choice={choice}
              locale={locale}
              failedText={tAddons.checkoutFailed}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackCard({
  view,
  index,
  canPay,
  paypalAvailable,
  copy,
  locale,
  tAddons,
  mostPopular,
  onBuy,
}: {
  view: PackView;
  /** Its place among exactly three packs, or null. */
  index: number | null;
  canPay: boolean;
  paypalAvailable: boolean;
  copy: BuyCreditsCopy;
  locale: Locale;
  tAddons: { perCredit: string; buyCredits: string; unavailable: string };
  mostPopular: string;
  onBuy: () => void;
}) {
  const { addon, featured } = view;
  const money = (cents: number) => formatMoney(cents, addon.currency, locale);
  const points = [
    ...(index === null ? [] : [copy.points[index]]),
    view.lowest ? copy.pointLowest : view.savePercent > 0 ? copy.pointBetter : copy.pointAdded,
  ];

  return (
    <article
      aria-labelledby={`pack-${addon.id}`}
      data-pack={addon.slug}
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl p-6",
        featured ? "border-2 border-primary bg-primary/5" : "border bg-card",
      )}
    >
      {featured ? (
        <span className="absolute -top-3.5 right-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          {mostPopular}
        </span>
      ) : null}
      {index === null ? null : (
        <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{copy.types[index]}</p>
      )}
      <h3 id={`pack-${addon.id}`} className="text-2xl leading-tight font-bold tracking-tight text-foreground">
        {formatNumber(addon.creditsGranted, locale)}{" "}
        <span className="text-base font-medium text-muted-foreground">{copy.creditsWord}</span>
      </h3>
      {index === null ? null : <p className="mt-2 text-sm leading-5 text-muted-foreground">{copy.descriptions[index]}</p>}

      <p className="mt-5 text-4xl font-bold tracking-tight text-foreground tabular-nums">{money(addon.priceCents)}</p>
      <p className="mt-2 flex min-h-6 flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{format(tAddons.perCredit, { price: money(view.perCreditCents) })}</span>
        {view.savePercent > 0 ? (
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {format(copy.save, { n: view.savePercent })}
          </span>
        ) : null}
      </p>

      <ul className="mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-foreground/80">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">{point}</span>
          </li>
        ))}
      </ul>

      <Button
        // The label may wrap rather than run out of a narrow card.
        className="mt-6 h-auto min-h-11 w-full rounded-xl py-2 text-center font-semibold whitespace-normal"
        variant={featured ? "default" : "outline"}
        onClick={onBuy}
        disabled={!canPay}
      >
        {canPay ? (
          <>
            {format(tAddons.buyCredits, { n: formatNumber(addon.creditsGranted, locale) })}
            <ArrowRight aria-hidden="true" />
          </>
        ) : (
          tAddons.unavailable
        )}
      </Button>
      {canPay ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="size-3 shrink-0" aria-hidden="true" />
          {paypalAvailable ? copy.cardOrPayPal : copy.cardOnly}
        </p>
      ) : null}
    </article>
  );
}

/** The content of the dialog: what is bought, how to pay, and on to the provider. */
function PackCheckout({
  pack,
  methods,
  copy,
  choice,
  locale,
  failedText,
}: {
  pack: AddonRow;
  methods: PaymentMethod[];
  copy: BuyCreditsCopy;
  choice: PaymentChoiceCopy;
  locale: Locale;
  failedText: string;
}) {
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? "card");
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    try {
      // To PayPal, the credits come only once RepGet has captured the payment (lib/paypal/orders.ts).
      const started = await (method === "paypal" ? buyAddonWithPayPal(pack.id) : buyAddon(pack.id));
      if ("error" in started) {
        toast.error(started.error);
        setPending(false);
        return;
      }
      // assign() rather than location.href: the React Compiler treats
      // assigning to an outer value as a mutation, while a method call is not.
      window.location.assign(started.url);
    } catch {
      toast.error(failedText);
      setPending(false);
    }
  }

  return (
    <PackCheckoutView
      title={<DialogTitle className="pr-8 text-xl font-bold tracking-tight">{copy.dialogTitle}</DialogTitle>}
      description={<DialogDescription className="mt-1.5 leading-5">{copy.dialogBody}</DialogDescription>}
      pack={pack}
      methods={methods}
      method={method}
      onMethod={setMethod}
      pending={pending}
      onPay={pay}
      copy={copy}
      choice={choice}
      locale={locale}
    />
  );
}

/** Separate from the dialog's own parts, so it can be rendered without one. */
export function PackCheckoutView({
  title,
  description,
  pack,
  methods,
  method,
  onMethod,
  pending,
  onPay,
  copy,
  choice,
  locale,
}: {
  title: ReactNode;
  description: ReactNode;
  pack: AddonRow;
  methods: PaymentMethod[];
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
  pending: boolean;
  onPay: () => void;
  copy: BuyCreditsCopy;
  choice: PaymentChoiceCopy;
  locale: Locale;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
        <Sparkles className="size-5" />
      </span>
      {title}
      {description}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">
            {formatNumber(pack.creditsGranted, locale)} {copy.creditsWord}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{copy.orderHelp}</p>
        </div>
        <p className="shrink-0 text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {formatMoney(pack.priceCents, pack.currency, locale)}
        </p>
      </div>
      <div className="mt-5">
        <PaymentMethodPicker methods={methods} value={method} onChange={onMethod} copy={choice} disabled={pending} />
      </div>
      <Button
        className="mt-5 h-auto min-h-11 w-full rounded-xl py-2 font-semibold whitespace-normal"
        onClick={onPay}
        disabled={pending || methods.length === 0}
      >
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        {method === "paypal" ? choice.continuePayPal : choice.continueCard}
        {pending ? null : <ArrowRight aria-hidden="true" />}
      </Button>
      <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {choice.note}
      </p>
    </div>
  );
}
