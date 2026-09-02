"use client";

import { Check, Loader2, Package, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
}: {
  addons: AddonRow[];
  purchases: PurchaseRow[];
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
      toast.error("Could not start checkout. Please try again.");
      setPendingId(null);
    }
  }

  if (addons.length === 0) return null;

  const credits = addons.filter((a) => a.kind === "credits");
  const services = addons.filter((a) => a.kind !== "credits");

  return (
    <div className="space-y-6">
      {credits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" aria-hidden="true" />
              More link credits
            </CardTitle>
            <CardDescription>
              Your plan includes credits each month. Buy more if you run out —
              these do not expire.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {credits.map((addon) => (
              <div
                key={addon.id}
                className="flex flex-col rounded-lg border p-4"
              >
                <p className="font-medium">{addon.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
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
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => handleBuy(addon.id)}
                  disabled={pendingId !== null || !addon.purchasable}
                >
                  {pendingId === addon.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {addon.purchasable ? "Buy" : "Unavailable"}
                </Button>
              </div>
            ))}
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
              {addon.purchasable ? "Buy this" : "Unavailable"}
            </Button>
          </CardContent>
        </Card>
      ))}

      {purchases.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
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
                      Added
                    </Badge>
                  ) : purchase.status === "fulfilled" ? (
                    <Badge className="gap-1">
                      <Check className="size-3" aria-hidden="true" />
                      Delivered
                    </Badge>
                  ) : (
                    <Badge variant="secondary">In progress</Badge>
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
