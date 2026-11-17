import { ArrowRight, CalendarClock, Check, Link2, Minus, PenLine, Plus, Sparkles, SquareActivity, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { SocialPublishingCopy } from "@/lib/marketing/social-publishing";

import { SectionHeading } from "./home-sections";

/**
 * The social-publishing landing page (lib/marketing/social-publishing.ts
 * holds its words and says why each claim is one the product backs): what
 * can and cannot be scheduled, the five steps from idea to published post,
 * the app's own statuses, requirements, questions and a call to sign up.
 *
 * Server-rendered and static, in the footer product pages' layout
 * (feature-page.tsx). Sign-up is /sign-up, the one address for every
 * language: it reads the language from this page's address
 * (lib/i18n/app-locale.ts authLocale). Campaign parameters are not passed
 * along by hand: the site's tag reads them on arrival.
 */

const CTA = "h-12 rounded-full px-7 text-base";

/** Step icons, in the order of `steps`. */
const STEP_ICONS: LucideIcon[] = [Sparkles, PenLine, Link2, CalendarClock, SquareActivity];

export function SocialPublishingContent({ copy, locale }: { copy: SocialPublishingCopy; locale: Locale }) {
  const actions = (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Button size="lg" asChild className={CTA}>
        <Link href="/sign-up">
          {copy.primaryCta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild className={CTA}>
        <Link href={localePath(locale, copy.secondaryCta.href)}>{copy.secondaryCta.label}</Link>
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

      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title={copy.scope.title} center />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="font-semibold text-primary">{copy.scope.canLabel}</h3>
              <ul className="mt-4 space-y-3">
                {copy.scope.can.map((point) => (
                  <li key={point} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-muted-foreground">{copy.scope.cannotLabel}</h3>
              <ul className="mt-4 space-y-3">
                {copy.scope.cannot.map((point) => (
                  <li key={point} className="flex gap-3 text-sm">
                    <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading title={copy.stepsTitle} center />
          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {copy.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? Sparkles;
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

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card p-6 text-center">
            <h3 className="font-semibold">{copy.statusTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{copy.statusBody}</p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {copy.statuses.map((status) => (
                <li key={status} className="rounded-full border px-3 py-1 text-sm font-medium">
                  {status}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title={copy.detailsTitle} center />
          <dl className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {copy.details.map((detail) => (
              <div key={detail.title} className="rounded-2xl border bg-card p-6">
                <dt className="font-semibold">{detail.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t px-4 py-16 sm:py-20">
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
