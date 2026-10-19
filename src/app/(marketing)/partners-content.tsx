import { ArrowRight, BadgePercent, CalendarClock, Handshake, Landmark } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProgramPolicy } from "@/lib/partners/domain/policies/program";
import { fill, type PartnerCopy } from "@/lib/partners/presentation/copy";
import { policyValues, rateLabel, sortedTiers } from "@/lib/partners/presentation/format";

/**
 * The public partner program page (/partners and its translations).
 *
 * Every rate, period and threshold on it comes from the program policy in
 * force (partner_program_versions), read per request like the pricing page:
 * the page cannot promise a figure the program does not pay. The rules are
 * stated before anyone shares a link - including that only Stripe-paid
 * subscriptions earn commission, and that refunds reverse it.
 *
 * While the program switch is off the page still explains the program, and
 * says applications are not open yet instead of offering the form.
 */
export function PartnersContent({
  copy,
  policy,
  open,
  locale,
  href,
}: {
  copy: PartnerCopy["page"];
  policy: ProgramPolicy;
  open: boolean;
  locale: string;
  href: (path: string) => string;
}) {
  const values = policyValues(policy, locale);
  const highlights = [
    { icon: BadgePercent, text: fill(copy.highlights.recurring, values) },
    { icon: CalendarClock, text: fill(copy.highlights.months, values) },
    { icon: Landmark, text: fill(copy.highlights.payout, values) },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <section className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Handshake className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-medium text-primary-strong">{copy.eyebrow}</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{copy.title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{copy.intro}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {open ? (
            <Button asChild size="lg">
              <Link href="/partner/apply">
                {copy.ctaApply}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <p role="status" className="rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              {copy.closed}
            </p>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/partner">{copy.ctaPortal}</Link>
          </Button>
        </div>
      </section>

      <ul className="mt-12 grid gap-3 sm:grid-cols-3">
        {highlights.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium">{text}</span>
          </li>
        ))}
      </ul>

      <section className="mt-16" aria-labelledby="partners-steps">
        <h2 id="partners-steps" className="text-xl font-semibold tracking-tight">{copy.stepsTitle}</h2>
        <ol className="mt-5 space-y-3">
          {copy.steps.map((step, index) => (
            <li key={step.title}>
              <Card>
                <CardContent className="flex gap-4 py-5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16" aria-labelledby="partners-tiers">
        <h2 id="partners-tiers" className="text-xl font-semibold tracking-tight">{copy.tiersTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.tiersIntro}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {sortedTiers(policy).map((tier) => (
            <li key={tier.key} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{tier.name}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{rateLabel(tier.rateBasisPoints)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {tier.minCustomers === 0 ? copy.tierStart : fill(copy.tierFrom, { count: tier.minCustomers })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 rounded-xl border bg-muted/30 p-6" aria-labelledby="partners-terms">
        <h2 id="partners-terms" className="font-semibold">{copy.termsTitle}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
          {copy.terms.map((term) => (
            <li key={term}>{fill(term, values)}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 flex flex-col gap-3 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="partners-credit">
        <div>
          <h2 id="partners-credit" className="font-semibold">{copy.creditTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.creditBody}</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={href("/affiliate")}>{copy.creditLink}</Link>
        </Button>
      </section>
    </div>
  );
}
