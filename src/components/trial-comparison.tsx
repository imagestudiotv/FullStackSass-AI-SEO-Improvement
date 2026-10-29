import { Check, X } from "lucide-react";

import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Free trial vs paid plan, side by side (client, 2026-10-27: "this difference
 * must be represented in the paid plan with the free plan").
 *
 * Shown under the plans on the pricing pages and on the plan step. Every
 * number comes from the constants and settings the product enforces -
 * FREE_ARTICLES, FREE_ARTICLES_DAYS, the trial's daily credits and
 * TRIAL_CREDIT_DAYS - so the promise and the product cannot drift. The paid
 * plan's credits are described, not counted: the client asked for credit
 * amounts not to be advertised beside a price.
 *
 * No hooks, so the plan step (a client component) can render it as well.
 */
export function TrialComparison({
  t,
  freeArticles,
  freeDays,
  trialDailyCredits,
  trialCreditDays,
  className,
}: {
  t: Messages["pricing"]["trial"];
  freeArticles: number;
  freeDays: number;
  /** The trial's daily credits (Admin -> Credits); 0 leaves the line out. */
  trialDailyCredits: number;
  trialCreditDays: number;
  className?: string;
}) {
  const trial: Line[] = [
    { text: format(t.articlesTrial, { articles: freeArticles }), included: true },
    { text: t.check, included: true },
    ...(trialDailyCredits > 0
      ? [{ text: format(t.creditsTrial, { count: trialDailyCredits, days: trialCreditDays }), included: true }]
      : []),
    { text: t.aiVisibility, included: false },
    { text: t.backlinks, included: false },
  ];
  const paid: Line[] = [
    { text: t.articlesPaid, included: true },
    { text: t.check, included: true },
    { text: t.creditsPaid, included: true },
    { text: t.aiVisibility, included: true },
    { text: t.backlinks, included: true },
  ];

  return (
    <section aria-labelledby="trial-comparison" className={cn("rounded-2xl border bg-card p-5 sm:p-6", className)}>
      <h2 id="trial-comparison" className="text-lg font-semibold tracking-tight">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {format(t.intro, { articles: freeArticles, days: freeDays })}
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Column name={t.trialName} lines={trial} notIncluded={t.notIncluded} />
        <Column name={t.paidName} lines={paid} notIncluded={t.notIncluded} />
      </div>
    </section>
  );
}

type Line = { text: string; included: boolean };

function Column({ name, lines, notIncluded }: { name: string; lines: Line[]; notIncluded: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{name}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((line) => (
          <li key={line.text} className="flex items-start gap-2.5">
            {line.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            )}
            <span className={line.included ? "text-muted-foreground" : "text-muted-foreground/70 line-through"}>
              {line.included ? null : <span className="sr-only">{notIncluded}: </span>}
              {line.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
