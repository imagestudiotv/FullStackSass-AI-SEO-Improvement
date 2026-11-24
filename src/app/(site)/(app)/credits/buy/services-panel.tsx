"use client";

import { Loader2, Package, Puzzle, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WorkspaceSection } from "@/components/workspace/section";
import { buyAddonWithCredits } from "@/lib/addons/actions";
import type { AddonRow } from "@/lib/addons/shared";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { websiteProjectKindOf, websiteProjectsHref } from "@/lib/website-projects/shared";

/** Where "Request a quote" goes: a website project has its own form, anything else the contact page. */
function quoteHref(slug: string): string {
  const kind = websiteProjectKindOf(slug);
  return kind ? websiteProjectsHref(kind) : `/contact?about=${encodeURIComponent(slug)}`;
}

/**
 * The other add-ons, under the credit packs: services our team delivers and
 * quotes priced after review - and each says which it is, because selling a
 * manual service beside an instant one without saying so is how refund
 * requests start.
 *
 * Only credit packs are paid by card. Services are bought with credits
 * (client, 2026-10-26: "everything can be purchased by credits now"), after
 * a second click that names the price, since nothing else stands between the
 * button and the balance.
 */
export function ServicesPanel({
  addons,
  t,
  tCredits,
}: {
  addons: AddonRow[];
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["addons"];
  /** How a number of credits is written ("250 credits"). */
  tCredits: Pick<Messages["app"]["credits"], "creditsCount">;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** The service whose price is being confirmed. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const credits = (count: number) => plural(tCredits.creditsCount, count);

  async function handleBuyWithCredits(addonId: string) {
    setPendingId(addonId);
    try {
      const result = await buyAddonWithCredits(addonId);
      if (!result.ok) {
        toast.error(
          result.error,
          // The packs are at the top of this page.
          result.needsCredits
            ? {
                action: {
                  label: t.buyCreditsAction,
                  onClick: () => document.getElementById("credit-packs")?.scrollIntoView({ behavior: "smooth" }),
                },
              }
            : undefined,
        );
        return;
      }
      setConfirming(null);
      toast.success(t.ordered);
      router.refresh();
    } catch {
      toast.error(t.checkoutFailed);
    } finally {
      setPendingId(null);
    }
  }

  /**
   * "quote" is priced after we see the work, so it cannot be bought from a
   * fixed Stripe price: it gets "Request a quote" instead of a Buy button.
   */
  const services = addons.filter((addon) => addon.kind !== "credits" && addon.kind !== "quote");
  const quotes = addons.filter((addon) => addon.kind === "quote");
  if (services.length === 0 && quotes.length === 0) return null;

  return (
    <WorkspaceSection id="services" icon={Puzzle} title={t.servicesTitle} description={t.servicesHelp}>
      <ul className="space-y-3">
        {services.map((addon) => {
          const price = addon.creditPrice && addon.creditPrice > 0 ? credits(addon.creditPrice) : null;
          const asking = confirming === addon.id;
          return (
            <li
              key={addon.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{addon.name}</h3>
                  {addon.description ? (
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {/* The price, or - after the first click - the question that names it. */}
                <p
                  className={cn("tabular-nums text-foreground", asking ? "text-sm font-medium" : "text-xl font-semibold")}
                  role={asking ? "status" : undefined}
                >
                  {asking && price ? format(t.confirmPay, { price }) : (price ?? t.unavailable)}
                </p>
                {asking ? (
                  <>
                    <Button onClick={() => handleBuyWithCredits(addon.id)} disabled={pendingId !== null}>
                      {pendingId === addon.id ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                      {t.confirm}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pendingId !== null}>
                      {t.cancel}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setConfirming(addon.id)} disabled={pendingId !== null || !price}>
                    {price ? t.buyThis : t.unavailable}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {quotes.map((addon) => (
          <li
            key={addon.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{addon.name}</h3>
                {addon.description ? (
                  <p className="text-sm text-muted-foreground">{addon.description}</p>
                ) : null}
                {/*
                  A guide price, not a total: the work depends on what
                  the audit found.
                */}
                <p className="text-sm text-muted-foreground">
                  {addon.creditPrice && addon.creditPrice > 0
                    ? format(t.quoteFrom, { price: credits(addon.creditPrice) })
                    : t.quoteHelp}
                </p>
              </div>
            </div>
            <Button variant="outline" className="shrink-0" asChild>
              <Link href={quoteHref(addon.slug)}>{t.requestQuote}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </WorkspaceSection>
  );
}
