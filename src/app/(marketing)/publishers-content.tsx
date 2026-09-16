import { ArrowRight, Check, PenLine, ShieldCheck, Sliders } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The publisher side of the backlink network.
 *
 * The brief lists a "Monetize your blog" page. What we can honestly offer is
 * not money — it is credits, earned by hosting an article, spendable on links
 * back to your own site. That is a genuinely useful trade for a small
 * business, and it is what the code actually does.
 *
 * Saying "monetize" and then paying in credits would be the kind of surprise
 * that loses the publisher on their first payout, so the page leads with what
 * they actually get.
 *
 * Copy comes from the dictionary so the localised routes render this same
 * component rather than drifting into five separate pages.
 */

/** Order matches `rules` in the dictionary; words there, icons here. */
const RULE_ICONS: LucideIcon[] = [ShieldCheck, Sliders, PenLine];

export function PublishersContent({
  t,
  href,
}: {
  t: Messages;
  /** Builds locale-aware paths, so a Spanish reader stays in Spanish. */
  href: (path: string) => string;
}) {
  const copy = t.publishers;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {copy.intro}
        </p>
      </div>

      {/*
        The thing people assume wrongly, said before anything else. A page
        titled "monetize" that pays in credits has to be honest about that in
        the first breath, not in a footnote.
      */}
      <Card className="mt-10 border-primary/30">
        <CardContent className="py-5">
          <p className="font-medium">{copy.creditsTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.creditsBody}
          </p>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-4">
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
          {copy.controlTitle}
        </h2>
        <div className="mt-5 space-y-4">
          {copy.rules.map((rule, index) => {
            const Icon = RULE_ICONS[index] ?? ShieldCheck;
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

      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">{copy.suitsTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.suitsBody}</p>
      </div>

      <div className="mt-14 text-center">
        <p className="text-muted-foreground">{copy.joinNote}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up">
              {copy.ctaPrimary}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={href("/backlink-exchange")}>
              <Check className="size-4" />
              {copy.ctaSecondary}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
