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
import { formatPrice, listPlans } from "@/lib/billing";
import {
  AuditBand,
  BacklinkNetwork,
  ClosingCta,
  Hero,
  HowItWorks,
  OneSubscription,
  Publishing,
  WhatYouSee,
} from "./home-sections";

/**
 * Marketing homepage, following the supplied landing design.
 *
 * Written for a small-business owner rather than an SEO professional: what the
 * product does for their business, not which techniques it uses.
 *
 * The design assumes a product with customers — "trusted by 10,000+
 * marketers", named case studies, a table pricing nine competitors. None of
 * that is true yet, so the structure is the design's and the claims are ours.
 * A fabricated testimonial is the fastest way to lose a real customer, and the
 * sections that would need one are noted in home-sections.tsx so they can be
 * added the moment there are real figures.
 */

// Reads live plan prices, so it cannot be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPlans();
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <>
      <Hero />
      <AuditBand />
      <HowItWorks />
      <OneSubscription />
      <Publishing />
      <WhatYouSee />
      <BacklinkNetwork />

      {/*
        Pricing preview. Reads the same plans table as /pricing and checkout, so
        a price change is made once and the homepage cannot advertise a number
        the checkout will not honour.
      */}
      <section id="pricing" className="scroll-mt-20 border-t px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Pricing
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
              Start small.{" "}
              <span className="text-primary">Grow when you are ready.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              A free check to start, no contract, and cancel whenever you like.
            </p>
          </div>

          {monthly.length === 0 ? (
            // Real state rather than a placeholder: with no plans configured we
            // say so rather than inventing prices checkout would not honour.
            <p className="mt-12 text-center text-sm text-muted-foreground">
              Pricing is not available right now. Please check back shortly.
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
                        Most popular
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
                            {" "}
                            / month
                          </span>
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <ul className="space-y-2.5 text-sm">
                          {[
                            `${plan.articleLimit} ${plan.articleLimit === 1 ? "article" : "articles"} each month`,
                            `${plan.siteLimit} ${plan.siteLimit === 1 ? "website" : "websites"}`,
                            `${plan.monthlyCredits} ${plan.monthlyCredits === 1 ? "link credit" : "link credits"}`,
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
                          <Link href="/sign-up">Get started</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link href="/pricing" className="underline underline-offset-4">
              See everything included in each plan
            </Link>
          </p>
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
