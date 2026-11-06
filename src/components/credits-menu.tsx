"use client";

import { Coins, Gift, History, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, plural } from "@/lib/i18n/format";

/**
 * The credit balance beside the logo (client, 2026-11-02): "credits on top
 * near the logo, you can click ... you can purchase or view the history".
 *
 * One balance: RepGet credits never expire, so there is no "plan credits
 * that reset" next to a wallet, as in the reference screenshot. What the
 * popover adds is today's daily credits and the two ways on: Buy credits (the
 * credit packs) and View history (the Credits page).
 */
export function CreditsMenu({
  available,
  today,
  t,
}: {
  available: number;
  /** Daily credits collected today; 0 when none. */
  today: number;
  t: {
    yourCredits: string;
    buyCredits: string;
    viewHistory: string;
    creditsNeverExpire: string;
    /** "{count} credit|{count} credits" */
    creditsCount: string;
    /** "+{count} today" */
    sidebarDaily: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const balance = plural(t.creditsCount, available);
  const daily = today > 0 ? format(t.sidebarDaily, { count: today }) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t.yourCredits}: ${balance}`}
          className="flex h-7 items-center gap-1 rounded-full border bg-background px-2 text-xs font-semibold tabular-nums transition-colors hover:bg-accent data-[state=open]:bg-accent"
        >
          {available}
          <Coins className="size-3.5 text-primary" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.yourCredits}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{available}</p>
          {daily ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Gift className="size-3.5" aria-hidden="true" />
              {daily}
            </p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t.creditsNeverExpire}</p>
        <div className="flex gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link href="/billing#addons" onClick={() => setOpen(false)}>
              <Plus aria-hidden="true" />
              {t.buyCredits}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href="/credits#credit-history" onClick={() => setOpen(false)}>
              <History aria-hidden="true" />
              {t.viewHistory}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
