"use client";

import { Check, Info, Loader2, Package, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSection, WorkspaceSubsection } from "@/components/workspace/section";
import { buyAddon } from "@/lib/addons/actions";
import type { AddonRow, PurchaseRow } from "@/lib/addons/shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { formatMoney } from "./billing-view";

/**
 * Dictionary KEYS for the terms every credit pack shares, looked up at render
 * (a module-level array exists before any locale does).
 */
const CREDIT_TERMS = ["oneTime", "neverExpire", "useAnytime"] as const;

/** listPurchases() returns at most this many rows (LIMIT 25 in lib/addons/actions.ts). */
const PURCHASES_SHOWN = 25;

/**
 * Add-ons: one-off purchases alongside the subscription, in one section.
 *
 * Credits are usable immediately; a service is work a person does; a quote is
 * priced after review - and each says which it is, because selling a manual
 * service beside an instant one without saying so is how refund requests
 * start.
 *
 * `canBuy` is false for someone who owns no website and came for somebody
 * else's (hasOnlySharedWork): their own workspace has no site to spend
 * credits on, and buyAddon would happily sell them some. The catalogue is
 * hidden for them, as the sidebar already hides Add-ons; their purchase
 * history, if any, still shows. Presentation only - the server is unchanged.
 */
export function AddonsPanel({
  addons,
  purchases,
  canBuy,
  locale,
  t,
  tCommon,
}: {
  addons: AddonRow[];
  purchases: PurchaseRow[];
  canBuy: boolean;
  /** For prices and purchase dates in the reader's convention. */
  locale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["addons"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleBuy(addonId: string) {
    setPendingId(addonId);
    try {
      const result = await buyAddon(addonId);
      if ("error" in result) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }
      // assign() rather than location.href: the React Compiler treats
      // assigning to an outer value as a mutation, while a method call is not.
      window.location.assign(result.url);
    } catch {
      toast.error(t.checkoutFailed);
      setPendingId(null);
    }
  }

  const catalogue = canBuy ? addons : [];
  if (catalogue.length === 0 && purchases.length === 0) return null;

  const credits = catalogue.filter((addon) => addon.kind === "credits");
  /**
   * "quote" is priced after we see the work, so it cannot be bought from a
   * fixed Stripe price: it gets "Request a quote" instead of a Buy button.
   */
  const services = catalogue.filter((addon) => addon.kind !== "credits" && addon.kind !== "quote");
  const quotes = catalogue.filter((addon) => addon.kind === "quote");
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <WorkspaceSection id="addons" icon={Sparkles} title={t.title} description={t.subtitle}>
      <div className="space-y-6">
        {credits.length > 0 ? (
          <WorkspaceSubsection title={t.moreCredits} description={t.moreCreditsHelp}>
            {/*
              The terms up front: they answer "is this another monthly
              charge?" before anything is compared.
            */}
            <p className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              {t.termsPill}
            </p>
            {/*
              Three across from lg only: beside the md sidebar a third of the
              section is too narrow for "Buy 100 credits" in most languages.
            */}
            <div className="grid items-stretch gap-4 pt-2 lg:grid-cols-3">
              {credits.map((addon, index) => {
                /*
                  The middle of three packs is highlighted, by position: the
                  packs are ordered by size, so it is the mid-size one. With
                  two there is no middle, and "most popular" would say nothing.
                */
                const featured = credits.length === 3 && index === 1;
                return (
                  <div
                    key={addon.id}
                    className={cn(
                      "relative flex min-w-0 flex-col rounded-lg p-4",
                      featured ? "border-2 border-primary bg-primary/5" : "border",
                    )}
                  >
                    {featured ? (
                      <Badge className="absolute -top-2.5 right-4">{tCommon.mostPopular}</Badge>
                    ) : null}
                    <h4 className="text-sm font-semibold text-foreground">{addon.name}</h4>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                      {money(addon.priceCents, addon.currency)}
                    </p>
                    {/* Per credit: how three packs are really compared. */}
                    {addon.creditsGranted > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {format(t.perCredit, {
                          price: money(Math.round(addon.priceCents / addon.creditsGranted), addon.currency),
                        })}
                      </p>
                    ) : null}
                    <ul className="mt-4 flex-1 space-y-2 border-t pt-4 text-sm">
                      {CREDIT_TERMS.map((term) => (
                        <li key={term} className="flex items-start gap-2">
                          <Check
                            className={cn("mt-0.5 size-4 shrink-0", featured ? "text-primary" : "text-muted-foreground")}
                            aria-hidden="true"
                          />
                          <span>{t[term]}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      // The label may wrap rather than run out of a narrow card; one line keeps h-8.
                      className="mt-4 h-auto min-h-8 w-full py-1.5 text-center whitespace-normal"
                      variant={featured ? "default" : "outline"}
                      onClick={() => handleBuy(addon.id)}
                      disabled={pendingId !== null || !addon.purchasable}
                    >
                      {pendingId === addon.id ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                      {addon.purchasable ? format(t.buyCredits, { n: addon.creditsGranted }) : t.unavailable}
                    </Button>
                  </div>
                );
              })}
            </div>
          </WorkspaceSubsection>
        ) : null}

        {services.length > 0 || quotes.length > 0 ? (
          <WorkspaceSubsection title={t.servicesTitle}>
            <ul className="space-y-3">
              {services.map((addon) => (
                <li
                  key={addon.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">{addon.name}</h4>
                      {addon.description ? (
                        <p className="text-sm text-muted-foreground">{addon.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold tabular-nums text-foreground">
                      {money(addon.priceCents, addon.currency)}
                    </p>
                    <Button onClick={() => handleBuy(addon.id)} disabled={pendingId !== null || !addon.purchasable}>
                      {pendingId === addon.id ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                      {addon.purchasable ? t.buyThis : t.unavailable}
                    </Button>
                  </div>
                </li>
              ))}
              {quotes.map((addon) => (
                <li
                  key={addon.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">{addon.name}</h4>
                      {addon.description ? (
                        <p className="text-sm text-muted-foreground">{addon.description}</p>
                      ) : null}
                      {/*
                        A guide price, not a total: the work depends on what
                        the audit found.
                      */}
                      <p className="text-sm text-muted-foreground">
                        {addon.priceCents > 0
                          ? format(t.quoteFrom, { price: money(addon.priceCents, addon.currency) })
                          : t.quoteHelp}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="shrink-0" asChild>
                    <Link href={`/contact?about=${encodeURIComponent(addon.slug)}`}>{t.requestQuote}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </WorkspaceSubsection>
        ) : null}

        {purchases.length > 0 ? (
          <WorkspaceSubsection title={t.yourPurchases}>
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
                        <span className="tabular-nums">{money(purchase.pricePaidCents, purchase.currency)}</span>
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
          </WorkspaceSubsection>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
