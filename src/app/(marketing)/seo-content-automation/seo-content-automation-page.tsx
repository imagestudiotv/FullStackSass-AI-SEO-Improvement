import { ArrowRight, CalendarRange, Check, Info, Minus, PenLine, Plus, Search, Send, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SeoContentAutomationCopy } from "@/lib/marketing/seo-content-automation";
import { signUpForPlan } from "@/lib/plans/features";

import { SectionHeading } from "../home-sections";

/**
 * The SEO-content-automation landing page (lib/marketing/seo-content-automation.ts
 * holds its words and says why each claim is one the product backs).
 *
 * Server-rendered, in the footer product pages' layout like the Italian
 * social-publishing page. The call to action is the standard Launch trial
 * journey - signUpForPlan, the address every Launch button on the site uses -
 * so the chosen plan reaches the onboarding plan step. No payment link and no
 * tracking of its own: the site's tag reads campaign parameters on arrival,
 * and a purchase is reported by the existing paid-acquisition outbox.
 */

const CTA = "h-12 rounded-full px-7 text-base";
const LAUNCH_SIGN_UP = signUpForPlan("launch");

const STEP_ICONS: LucideIcon[] = [Search, CalendarRange, PenLine, Send];

export function SeoContentAutomationContent({ copy }: { copy: SeoContentAutomationCopy }) {
  const actions = (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Button size="lg" asChild className={CTA}>
        <Link href={LAUNCH_SIGN_UP}>
          {copy.primaryCta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild className={CTA}>
        <Link href="/pricing">{copy.secondaryCta}</Link>
      </Button>
    </div>
  );

  return (
    <>
      <section className="px-4 pt-16 pb-14 text-center sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{copy.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{copy.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{copy.intro}</p>
          {actions}
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title={copy.stepsTitle} center />
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Search;
              return (
                <li key={step.title} className="rounded-2xl border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              );
            })}
          </ol>

          <div id="publishing" className="mx-auto mt-10 max-w-3xl rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="flex items-center gap-2 font-semibold">
              <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
              {copy.publishing.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {copy.publishing.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title={copy.connectionsTitle} center />
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">{copy.connectionsIntro}</p>
          <dl className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {copy.connections.map((connection) => (
              <div key={connection.name} className="rounded-2xl border bg-card p-6">
                <dt className="font-semibold">{connection.name}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{connection.setup}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {copy.connectionsNote}{" "}
            <Link href="/docs/integrations" className="font-medium text-primary underline-offset-4 hover:underline">
              {copy.connectionsLink}
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="text-xl font-semibold">{copy.planTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.planIntro}</p>
            <ul className="mt-4 space-y-3">
              {copy.planPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">{copy.limitsTitle}</h2>
            <ul className="mt-4 space-y-3">
              {copy.limits.map((point) => (
                <li key={point} className="flex gap-3 text-sm">
                  <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div id="terms" className="mx-auto mt-4 max-w-5xl rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-semibold">{copy.termsTitle}</h2>
          <ul className="mt-4 space-y-3">
            {copy.terms.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/refunds" className="font-medium text-primary underline-offset-4 hover:underline">
              {copy.termsLinks.refunds}
            </Link>
            <Link href="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
              {copy.termsLinks.terms}
            </Link>
            <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
              {copy.termsLinks.pricing}
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={copy.faqTitle} center />
          <div className="mt-10 divide-y rounded-2xl border bg-card px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6">
            {copy.faq.map((item) => (
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
        </div>
      </section>

      <section className="border-t px-4 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{copy.closingTitle}</h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">{copy.closingBody}</p>
          {actions}
        </div>
      </section>
    </>
  );
}
