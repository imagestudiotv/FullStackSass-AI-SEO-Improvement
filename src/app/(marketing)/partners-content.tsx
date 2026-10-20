import { ArrowRight, BadgePercent, Briefcase, CalendarClock, Handshake, Landmark, Megaphone, PenLine, Plus, Video } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EarningsCalculator, type CalculatorPlan } from "@/components/partners/earnings-calculator";
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
 *
 * The funnel follows what the competitors' affiliate pages do (client brief):
 * the offer, an earnings estimate, how it works, the levels, who it is for,
 * the rules, questions and answers, and a closing call to apply. No partner
 * counts, payout totals or testimonials: RepGet has none yet, and a made-up
 * figure would mislead the people it is meant to convince.
 */
export function PartnersContent({
  copy,
  policy,
  open,
  locale,
  href,
  plans = [],
  intlLocale = "en-IE",
}: {
  copy: PartnerCopy["page"];
  policy: ProgramPolicy;
  open: boolean;
  locale: string;
  href: (path: string) => string;
  /** Active monthly plans, for the earnings estimate (none: no estimate). */
  plans?: CalculatorPlan[];
  intlLocale?: string;
}) {
  const values = policyValues(policy, locale);
  const tiers = sortedTiers(policy);
  const faqValues = {
    ...values,
    tiers: tiers
      .filter((tier) => tier.minCustomers > 0)
      .map((tier) => fill(copy.tierPhrase, { rate: rateLabel(tier.rateBasisPoints), count: tier.minCustomers }))
      .join(", "),
  };
  const faq = copy.faq.map((item) => ({ question: item.question, answer: fill(item.answer, faqValues) }));
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
  const apply = open ? (
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
  );
  const highlights = [
    { icon: BadgePercent, text: fill(copy.highlights.recurring, values) },
    { icon: CalendarClock, text: fill(copy.highlights.months, values) },
    { icon: Landmark, text: fill(copy.highlights.payout, values) },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <script
        type="application/ld+json"
        // Serialised from our own copy and the program policy, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
      />
      <section className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Handshake className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-medium text-primary-strong">{copy.eyebrow}</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{copy.title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{copy.intro}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {apply}
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

      <EarningsCalculator
        plans={plans}
        tiers={tiers.map((tier) => ({ name: tier.name, rateBasisPoints: tier.rateBasisPoints, minCustomers: tier.minCustomers }))}
        months={policy.eligibilityMonths}
        copy={copy.calculator}
        intlLocale={intlLocale}
      />

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
          {tiers.map((tier) => (
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

      <section className="mt-16" aria-labelledby="partners-audience">
        <h2 id="partners-audience" className="text-xl font-semibold tracking-tight">{copy.audienceTitle}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {copy.audience.map((group, index) => {
            const Icon = AUDIENCE_ICONS[index % AUDIENCE_ICONS.length];
            return (
              <li key={group.title} className="flex gap-3 rounded-xl border bg-card p-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">{group.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{group.body}</p>
                </div>
              </li>
            );
          })}
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

      <section className="mt-16" aria-labelledby="partners-faq">
        <h2 id="partners-faq" className="text-xl font-semibold tracking-tight">{copy.faqTitle}</h2>
        {/* Native details/summary, as on the homepage: answers are in the HTML whether or not they are open. */}
        <div className="mt-5 divide-y rounded-xl border bg-card px-5">
          {faq.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-medium focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors group-open:border-primary/30 group-open:bg-primary/10 group-open:text-primary"
                >
                  <Plus className="size-4 motion-safe:transition-transform group-open:rotate-45" />
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl border bg-card p-6 text-center sm:p-8" aria-labelledby="partners-cta">
        <h2 id="partners-cta" className="text-xl font-semibold tracking-tight">{copy.ctaTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{copy.ctaBody}</p>
        <div className="mt-6 flex justify-center">{apply}</div>
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

/** In the order of `copy.audience`: creators, agencies, video, business owners. */
const AUDIENCE_ICONS = [PenLine, Megaphone, Video, Briefcase];

/** The earnings estimate's choices: the active monthly plans that cost something. */
export function calculatorPlans(plans: { id: string; name: string; interval: string; priceCents: number; currency: string }[]): CalculatorPlan[] {
  return plans
    .filter((plan) => plan.interval === "month" && plan.priceCents > 0)
    .map((plan) => ({ id: plan.id, name: plan.name, priceCents: plan.priceCents, currency: plan.currency }));
}
