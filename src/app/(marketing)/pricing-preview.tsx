import { Check } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import type { SectionProps } from "./home-sections";

/**
 * Pricing preview on the homepage.
 *
 * Reads the same plans table as /pricing and checkout, so a price change is
 * made once and the homepage cannot advertise a number the checkout will not
 * honour. Only the surrounding copy is translated — the prices are the prices,
 * and plan names stay in English because they are product names, not words.
 * "Launch" is what appears on the invoice.
 */
export function PricingPreview({
  t,
  href,
  plans,
}: SectionProps & { plans: PlanRow[] }) {
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <section id="pricing" className="scroll-mt-20 border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {t.pricingEyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.pricingTitle}{" "}
            <span className="text-primary">{t.pricingTitleAccent}</span>
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">{t.pricingSub}</p>
        </div>

        {monthly.length === 0 ? (
          // Real state rather than a placeholder: with no plans configured we
          // say so rather than inventing prices checkout would not honour.
          <p className="mt-12 text-sm text-muted-foreground">
            {t.unavailable}
          </p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {monthly.map((plan) => {
              const featured = plan.tier === "grow";
              return (
                /*
                  The badge sits on a WRAPPER, not the Card. Card carries
                  overflow-hidden so images clip to its rounded corners, which
                  also cut this badge in half at the border.
                */
                <div key={plan.id} className="relative pt-2.5">
                  {featured ? (
                    <Badge className="absolute top-0 left-6 z-10 shadow-sm">
                      {t.mostPopular}
                    </Badge>
                  ) : null}
                  <Card
                    className={`h-full ${featured ? "border-primary/40 shadow-sm" : ""}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <CardDescription>
                        <span className="text-3xl font-semibold text-foreground">
                          {formatPrice(plan.priceCents, plan.currency)}
                        </span>
                        <span className="text-muted-foreground">
                          {t.perMonth}
                        </span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-2.5 text-sm">
                        {[
                          t.planArticles(plan.articleLimit),
                          t.planWebsites(plan.siteLimit),
                          t.planCredits(plan.monthlyCredits),
                        ].map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5"
                          >
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                            <span className="text-muted-foreground">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <Button
                        asChild
                        className="w-full"
                        variant={featured ? "default" : "outline"}
                      >
                        <Link href="/sign-up">{t.getStartedPlan}</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          <Link
            href={href("/pricing")}
            className="underline underline-offset-4"
          >
            {t.seeAllPlans}
          </Link>
        </p>
      </div>
    </section>
  );
}
