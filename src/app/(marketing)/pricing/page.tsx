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

export const metadata = {
  title: "Pricing",
  description: "Simple monthly pricing. Cancel any time.",
};

/**
 * Public pricing page.
 *
 * Reads the same plans table the billing page and Stripe checkout use, so a
 * price change is made once and cannot drift between what we advertise and
 * what we charge. Hardcoding these numbers would eventually mean quoting a
 * price the checkout does not honour.
 */
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await listPlans();
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple pricing
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Everything is included in every plan. The difference is how much we
          write for you each month.
        </p>
      </div>

      {monthly.length === 0 ? (
        // Real state, not a placeholder: if no plans are configured we say so
        // rather than inventing prices that checkout would not honour.
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Pricing is not available right now. Please check back shortly.
        </p>
      ) : (
        // Four tiers since Starter: two up at tablet width, four on desktop.
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {monthly.map((plan) => {
            /**
             * Named rather than positional. This was `index === 1`, which
             * silently moved to Launch when Starter was added at the front — a
             * highlight that follows array order rather than the actual
             * recommendation is wrong the first time the line-up changes.
             */
            const featured = plan.tier === "grow";
            return (
              <Card
                key={plan.id}
                className={
                  featured
                    ? "relative border-primary/40 shadow-sm"
                    : "relative"
                }
              >
                {featured ? (
                  <Badge className="absolute -top-2.5 left-6">
                    Most popular
                  </Badge>
                ) : null}

                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-semibold text-foreground">
                      {formatPrice(plan.priceCents, plan.currency)}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-2.5 text-sm">
                    {[
                      // Pluralised per count: Starter has a limit of one for
                      // three of these, and "1 articles" on the entry plan is
                      // the first thing a prospective customer reads.
                      `${plan.articleLimit} ${plan.articleLimit === 1 ? "article" : "articles"} written each month`,
                      `${plan.keywordLimit.toLocaleString()} ${plan.keywordLimit === 1 ? "search term" : "search terms"} tracked`,
                      `${plan.siteLimit} ${plan.siteLimit === 1 ? "website" : "websites"}`,
                      `${plan.monthlyCredits} ${plan.monthlyCredits === 1 ? "link credit" : "link credits"} each month`,
                      "Website health checks",
                      "Publish straight to WordPress",
                    ].map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-muted-foreground">{feature}</span>
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
            );
          })}
        </div>
      )}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Annual plans are available once you sign up, at two months free. Cancel
        any time — see our <Link href="/refunds" className="underline underline-offset-4">refund policy</Link>.
      </p>
    </div>
  );
}
