import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Localised pricing.
 *
 * Prices come from the same plans table as the English page, so a price change
 * is made once and cannot drift between languages. Only the surrounding copy is
 * translated — the numbers are the numbers.
 *
 * formatPrice already renders the currency correctly; the plan NAMES stay in
 * English because they are product names, not words. "Launch" is what the
 * customer sees on their invoice.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);

  return {
    title: t.pricing.title,
    description: t.pricing.subtitle,
    alternates: {
      canonical: localePath(locale, "/pricing"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/pricing")]),
      ),
    },
  };
}

export default async function LocalisedPricingPage({
  params,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);
  const plans = await listPlans();
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.pricing.title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          {t.pricing.subtitle}
        </p>
      </div>

      {monthly.length === 0 ? (
        // Real state, not a placeholder: with no plans configured we say so
        // rather than inventing prices checkout would not honour.
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {t.pricing.unavailable}
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {monthly.map((plan) => {
            const featured = plan.tier === "grow";
            return (
              <Card
                key={plan.id}
                className={
                  featured ? "relative border-primary/40 shadow-sm" : "relative"
                }
              >
                {featured ? (
                  <Badge className="absolute -top-2.5 left-6">
                    {t.pricing.mostPopular}
                  </Badge>
                ) : null}

                <CardHeader>
                  {/* Plan names are product names, not words to translate. */}
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-semibold text-foreground">
                      {formatPrice(plan.priceCents, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {t.pricing.perMonth}
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-2.5 text-sm">
                    {[
                      t.pricing.features.articles(plan.articleLimit),
                      t.pricing.features.keywords(
                        plan.keywordLimit.toLocaleString(locale),
                      ),
                      t.pricing.features.websites(plan.siteLimit),
                      t.pricing.features.credits(plan.monthlyCredits),
                      t.pricing.features.healthChecks,
                      t.pricing.features.publishing,
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
                    <Link href="/sign-up">{t.pricing.getStarted}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        {t.pricing.annualNote}{" "}
        <Link href="/refunds" className="underline underline-offset-4">
          {t.pricing.refundPolicy}
        </Link>
        .
      </p>
    </div>
  );
}
