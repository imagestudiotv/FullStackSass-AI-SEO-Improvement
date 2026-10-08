import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { plural } from "@/lib/i18n/format";
import { STARTER_TIER } from "@/lib/plans/features";
import { Button } from "@/components/ui/button";
import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { OFFSCREEN, SectionHeading, type SectionProps } from "./home-sections";

/**
 * Pricing preview on the homepage.
 *
 * Reads the same plans table as /pricing and checkout, so a price change is
 * made once and the homepage cannot advertise a number the checkout will not
 * honour. Only the surrounding copy is translated — the prices are the prices,
 * and plan names stay in English because they are product names, not words.
 * "Launch" is what appears on the invoice.
 *
 * However many monthly plans there are, the grid balances itself: one card
 * centred, two side by side, three across, four or more in rows of four.
 */
const GRID: Record<number, string> = {
  1: "mx-auto max-w-md grid-cols-1",
  2: "mx-auto max-w-3xl grid-cols-1 sm:grid-cols-2",
  3: "mx-auto max-w-5xl grid-cols-1 md:grid-cols-3",
};
const GRID_MANY = "mx-auto max-w-6xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

export function PricingPreview({
  t,
  href,
  plans,
}: SectionProps & { plans: PlanRow[] }) {
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <section id="pricing" className={`${OFFSCREEN} scroll-mt-20 border-t bg-primary/[0.025] px-4 py-20`}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          center
          eyebrow={t.pricingEyebrow}
          title={t.pricingTitle}
          accent={t.pricingTitleAccent}
          sub={t.pricingSub}
        />

        {monthly.length === 0 ? (
          // Real state rather than a placeholder: with no plans configured we
          // say so rather than inventing prices checkout would not honour.
          <p className="mt-12 text-center text-sm text-muted-foreground">{t.unavailable}</p>
        ) : (
          <ul className={`mt-12 grid gap-6 ${GRID[monthly.length] ?? GRID_MANY}`}>
            {monthly.map((plan) => {
              const featured = plan.tier === "grow";
              const isStarter = plan.tier === STARTER_TIER;
              const badge = featured ? t.mostPopular : isStarter ? t.tryItFirst : null;
              return (
                <li
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
                    featured
                      ? "border-primary/40 bg-card shadow-[0_24px_60px_-30px_rgba(234,88,12,0.45)] ring-1 ring-primary/20"
                      : isStarter
                        ? "border-success/30 bg-card"
                        : "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {badge ? (
                    <span
                      className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                        featured
                          ? "bg-primary text-primary-foreground"
                          : "border border-success/30 bg-success-soft text-success"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}

                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">
                      {formatPrice(plan.priceCents, plan.currency)}
                    </span>
                    <span className="text-sm text-muted-foreground">{t.perMonth}</span>
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 border-t pt-6 text-sm">
                    {[
                      plural(t.planArticles, plan.articleLimit, {
                        n: plan.articleLimit,
                      }),
                      /* Capability, not counts — see messages.ts. */
                      t.planBacklinks,
                      t.planPublishing,
                    ].map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15"
                          aria-hidden="true"
                        >
                          <Check className="size-3 text-primary-strong" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    className="mt-7 h-11 w-full rounded-full text-base"
                    variant={featured ? "default" : "outline"}
                  >
                    <Link href="/sign-up">{t.getStartedPlan}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 text-center text-sm">
          <Link
            href={href("/pricing")}
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {t.seeAllPlans}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
