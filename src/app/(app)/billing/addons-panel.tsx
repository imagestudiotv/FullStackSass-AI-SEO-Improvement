"use client";

import { Check, Info, Loader2, Package, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Messages } from "@/lib/i18n/messages";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buyAddon } from "@/lib/addons/actions";
import type { AddonRow, PurchaseRow } from "@/lib/addons/shared";
import { formatPrice } from "@/lib/billing-shared";

/**
 * The terms every credit pack shares, listed on each card.
 *
 * Constant rather than per-row data because they are properties of how credits
 * work, not of a particular pack — if one pack ever expired, that would be a
 * different product and would need saying on that card, not editing here.
 */
/**
 * Dictionary KEYS, looked up at render.
 *
 * A module-level array is built before any locale exists, so it cannot
 * hold the text itself — the same reason STEP_LABEL and ARTICLE_STATUS
 * became lookups.
 */
const CREDIT_TERMS = [
  "oneTime",
  "neverExpire",
  "useAnytime",
] as const;

/**
 * Add-ons: one-off purchases alongside the subscription.
 *
 * Two kinds, and the difference is stated plainly rather than left for the
 * customer to discover. Credits are usable immediately; the citations package
 * is work a person does, so it says that and gives a timeframe. Selling a
 * manual service in the same UI as an instant one, without saying which is
 * which, is how refund requests start.
 */
export function AddonsPanel({
  addons,
  purchases,
  t,
  tCommon,
}: {
  addons: AddonRow[];
  purchases: PurchaseRow[];
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

  if (addons.length === 0) return null;

  const credits = addons.filter((a) => a.kind === "credits");
  /**
   * "quote" is a service whose price depends on what we find, so it cannot be
   * bought from a fixed Stripe price the way a citations package can. It gets
   * a "Request a quote" link instead of a Buy button — offering checkout for
   * something we have not priced yet would take money for undefined work.
   */
  const services = addons.filter(
    (a) => a.kind !== "credits" && a.kind !== "quote",
  );
  const quotes = addons.filter((a) => a.kind === "quote");

  return (
    <div className="space-y-6">
      {credits.length > 0 ? (
        <Card>
          {/*
            The design puts a terms pill opposite the heading. It repeats what
            the cards say, which is the point: it is visible before the reader
            has compared anything, where it answers "is this another monthly
            charge?" — the question that stops a one-off purchase.
          */}
          <CardHeader className="sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" aria-hidden="true" />
                {t.moreCredits}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {t.moreCreditsHelp}
              </CardDescription>
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:mt-0">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              {t.termsPill}
            </p>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-3">
            {credits.map((addon, index) => {
              /**
               * The middle pack is highlighted, as in the design.
               *
               * By position rather than a flag on the row: the packs are
               * ordered by size already, so the middle one is the mid-size
               * option whatever the three happen to be. A hardcoded slug
               * would silently highlight nothing if the packs were renamed.
               *
               * Only when there are three — with two packs there is no middle,
               * and marking one of two as "most popular" says nothing.
               */
              const featured = credits.length === 3 && index === 1;

              return (
                <div
                  key={addon.id}
                  className={
                    featured
                      ? "relative flex flex-col rounded-xl border-2 border-primary bg-primary/5 p-4 shadow-sm"
                      : "relative flex flex-col rounded-xl border p-4"
                  }
                >
                  {featured ? (
                    <Badge className="absolute -top-2.5 right-4 shadow-sm">
                      {tCommon.mostPopular}
                    </Badge>
                  ) : null}

                  <p className="font-medium">{addon.name}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatPrice(addon.priceCents, addon.currency)}
                  </p>
                  {/*
                    Per-credit price, because that is how someone actually
                    compares three packs and it is the reason to buy the bigger
                    one.
                  */}
                  {addon.creditsGranted > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(
                        Math.round(addon.priceCents / addon.creditsGranted),
                        addon.currency,
                      )}{" "}
                      per credit
                    </p>
                  ) : null}

                  {/*
                    The three terms from the design, spelled out per card.
                    They are the same on every pack and already stated once
                    above, but a customer comparing cards reads the card — and
                    "credits never expire" is the line that makes the bigger
                    pack a safe buy rather than a gamble.
                  */}
                  <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
                    {CREDIT_TERMS.map((term) => (
                      <li key={term} className="flex items-center gap-2">
                        <Check
                          className={
                            featured
                              ? "size-4 shrink-0 text-primary"
                              : "size-4 shrink-0 text-muted-foreground"
                          }
                          aria-hidden="true"
                        />
                        <span>{t[term]}</span>
                      </li>
                    ))}
                  </ul>

                  {/*
                    mt-auto so the three buttons sit on one line even when a
                    pack name wraps to two.
                  */}
                  <Button
                    className="mt-4 w-full"
                    variant={featured ? "default" : "outline"}
                    onClick={() => handleBuy(addon.id)}
                    disabled={pendingId !== null || !addon.purchasable}
                  >
                    {pendingId === addon.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {addon.purchasable
                      ? t.buyCredits(addon.creditsGranted)
                      : t.unavailable}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {services.map((addon) => (
        <Card key={addon.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" aria-hidden="true" />
              {addon.name}
            </CardTitle>
            <CardDescription>{addon.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-2xl font-semibold tabular-nums">
              {formatPrice(addon.priceCents, addon.currency)}
            </p>
            <Button
              onClick={() => handleBuy(addon.id)}
              disabled={pendingId !== null || !addon.purchasable}
            >
              {pendingId === addon.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {addon.purchasable ? t.buyThis : t.unavailable}
            </Button>
          </CardContent>
        </Card>
      ))}

      {quotes.map((addon) => (
        <Card key={addon.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4" aria-hidden="true" />
              {addon.name}
            </CardTitle>
            <CardDescription>{addon.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            {/*
              A guide price, not a total. The work depends on what the audit
              found, and quoting a single figure for "fix my site" would be a
              number we could not stand behind.
            */}
            <p className="text-sm text-muted-foreground">
              {addon.priceCents > 0
                ? `From ${formatPrice(addon.priceCents, addon.currency)}. We quote for the work after reviewing your audit.`
                : t.quoteHelp}
            </p>
            <Button variant="outline" asChild>
              <Link href={`/contact?about=${encodeURIComponent(addon.slug)}`}>
                {t.requestQuote}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}

      {purchases.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.yourPurchases}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {purchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{purchase.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(purchase.createdAt).toLocaleDateString()} ·{" "}
                      {formatPrice(purchase.pricePaidCents, purchase.currency)}
                    </p>
                  </div>
                  {/*
                    Credits are done the moment they are paid for. A manual
                    service is not, so it reads "in progress" until a human
                    marks it delivered.
                  */}
                  {purchase.kind === "credits" ? (
                    <Badge className="gap-1">
                      <Check className="size-3" aria-hidden="true" />
                      {t.added}
                    </Badge>
                  ) : purchase.status === "fulfilled" ? (
                    <Badge className="gap-1">
                      <Check className="size-3" aria-hidden="true" />
                      {t.delivered}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t.inProgress}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
