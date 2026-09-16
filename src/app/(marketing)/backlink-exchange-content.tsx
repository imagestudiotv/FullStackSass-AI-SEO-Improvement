import { ArrowRight, CalendarCheck, Link2, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Messages } from "@/lib/i18n/messages";

/**
 * How the backlink exchange works, for a prospect.
 *
 * Links are the hardest thing for a small business to earn and the easiest
 * thing to be sold badly, so this page leads with the mechanism rather than
 * with a promise: you host an article, you earn a credit, you spend it.
 *
 * Copy comes from the dictionary so the localised routes render this same
 * component rather than drifting into five separate pages.
 */

/** Order matches `rules` in the dictionary; words there, icons here. */
const RULE_ICONS: LucideIcon[] = [Target, CalendarCheck, RefreshCw];

export function BacklinkExchangeContent({
  t,
  href,
}: {
  t: Messages;
  /** Builds locale-aware paths, so a Spanish reader stays in Spanish. */
  href: (path: string) => string;
}) {
  const copy = t.backlinkExchange;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {copy.intro}
        </p>
      </div>

      <div className="mt-14 space-y-4">
        {copy.steps.map((step, index) => (
          <Card key={step.title}>
            <CardContent className="flex gap-4 py-5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-14">
        <h2 className="text-xl font-medium tracking-tight">
          {copy.rulesTitle}
        </h2>
        <div className="mt-5 space-y-4">
          {copy.rules.map((rule, index) => {
            const Icon = RULE_ICONS[index] ?? Target;
            return (
              <div key={rule.title} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">{rule.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {rule.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*
        Said plainly rather than buried. Anyone who has been sold link building
        before has been sold a private blog network, and the honest difference
        is worth more than a claim we cannot back.
      */}
      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">{copy.notTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.notBody}</p>
      </div>

      <div className="mt-14 text-center">
        <p className="text-muted-foreground">{copy.ctaBody}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up">
              {copy.ctaPrimary}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={href("/pricing")}>{copy.ctaSecondary}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
