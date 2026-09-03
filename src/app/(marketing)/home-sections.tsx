import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileText,
  Link2,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Messages } from "@/lib/i18n/messages";

/**
 * Homepage sections, following the supplied landing design.
 *
 * Every section takes its copy as a prop rather than hardcoding English. The
 * localised homepage used to be a separate, much simpler page — /es rendered
 * one section where / rendered nine — and the two drifted apart the moment the
 * English one was redesigned. Rendering both from these components means a
 * section added here appears in every language.
 *
 * The design is built around a product with customers: "trusted by 10,000+
 * marketers", named case studies with 855% growth, a table pricing nine named
 * competitors. None of that is true here yet, and a fake testimonial is the
 * fastest way to lose a real customer — so the structure is the design's and
 * the content is what we can stand behind. The sections that would need
 * invented figures are noted below so they can be filled in once real ones
 * exist.
 */
export type SectionProps = {
  t: Messages["home"];
  /** Builds locale-aware paths: unchanged on English, prefixed on /es. */
  href: (path: string) => string;
};

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The floating cards from the design.
 *
 * They name what the product tracks rather than claiming results. The design's
 * versions carry specific numbers ("65 positions", "3,500 organic traffic")
 * which would read as a customer's actual figures, so these show the metric and
 * leave the number to the customer's own dashboard.
 *
 * Icons and positions live here; the labels come from the translations.
 */
const HERO_CARD_STYLE: { icon: LucideIcon; className: string }[] = [
  { icon: Search, className: "left-[6%] top-10 -rotate-6" },
  { icon: Bot, className: "left-[2%] top-56 rotate-3" },
  { icon: Link2, className: "right-[6%] top-8 rotate-6" },
  { icon: FileText, className: "right-[2%] top-60 -rotate-3" },
];

/** The shared lg size is h-9 — right for a form, too small for a hero. */
const CTA = "h-12 rounded-full px-7 text-base";

export function Hero({ t, href }: SectionProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {t.eyebrow}
        </p>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {t.title}
          <span className="text-primary">.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          {t.subtitle}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild className={CTA}>
            <Link href={href("/audit")}>
              {t.checkFree}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className={CTA}>
            {/* Sign-up is not localised, so it keeps its own path. */}
            <Link href="/sign-up">{t.getStarted}</Link>
          </Button>
        </div>

        {/*
          The design has a "Trusted by 10,000+ marketers" row with avatars and
          five stars here. Left out until it is true; what replaces it is a
          real fact.
        */}
        <p className="mt-6 text-sm text-muted-foreground">{t.noCard}</p>
      </div>

      {/*
        Floating cards, hidden below xl. At narrower widths they would either
        overlap the headline or stack into a meaningless list.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-full max-w-6xl xl:block"
        aria-hidden="true"
      >
        {t.tracked.slice(0, 4).map((card, index) => {
          const style = HERO_CARD_STYLE[index];
          const Icon = style.icon;
          return (
            <div
              key={card.label}
              className={`absolute w-48 rounded-xl border bg-card p-3.5 shadow-lg ${style.className}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Free-with-your-audit band                                                  */
/* -------------------------------------------------------------------------- */

export function AuditBand({ t, href }: SectionProps) {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {t.auditBand}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {t.auditItems.map((item, index) => (
            <div key={item.title} className="sm:pr-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="text-primary">{index + 1}.</span>
                {item.title}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        {/*
          The design puts a domain field here. Ours links to /audit rather than
          duplicating the form: that page already handles validation, rate
          limiting and the SSRF guard, and a second entry point would be a
          second copy of all of it.
        */}
        <div className="mt-7">
          <Button
            size="lg"
            asChild
            className="h-12 w-full rounded-full px-7 text-base sm:w-auto"
          >
            <Link href={href("/audit")}>
              {t.checkMyWebsite}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

export function HowItWorks({ t }: SectionProps) {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.howItWorks}
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {t.steps.map((step, index) => (
            /*
              The badge sits on a WRAPPER rather than on the Card. Card carries
              overflow-hidden — it needs it so images clip to the rounded
              corners — so a badge positioned outside the card is cut in half
              at the border.
            */
            <div key={step.title} className="relative pt-3">
              <span className="absolute top-0 left-6 z-10 flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                {index + 1}
              </span>
              <Card className="h-full">
                <CardContent className="pt-6 pb-6">
                  <p className="text-lg font-medium">{step.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.body}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Problem / solution                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Problems on the left as separate cards, our answer on the right as one solid
 * panel. The asymmetry is the argument: three scattered complaints against one
 * consolidated answer.
 *
 * The design puts a customer photo beside each problem. Those are real people
 * from a real product, so these carry no avatars rather than stock faces
 * pretending to be customers.
 */
export function ProblemSolution({ t }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {t.problemsEyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.yourProblem}
          <br />
          <span className="text-primary">{t.ourSolution}</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="space-y-4">
            {t.problems.map((problem) => (
              <div key={problem} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{problem}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
            <p className="font-medium">{t.solutionTitle}</p>
            <ul className="mt-5 space-y-3">
              {t.solution.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-primary-foreground/95">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* One subscription replaces your stack                                       */
/* -------------------------------------------------------------------------- */

/**
 * The design shows this as a table pricing nine named competitors against us,
 * totalling "$1,140+/mo". Those are other companies' prices, they change
 * without telling us, and getting one wrong in our favour is the kind of claim
 * that ends in a complaint. This lists what we do instead.
 */
export function OneSubscription({ t, href }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {t.stackEyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.stackTitle}{" "}
            <span className="text-primary">{t.stackTitleAccent}</span>
          </h2>
          <p className="mt-4 text-muted-foreground">{t.stackSub}</p>
          <Button asChild className="mt-7">
            <Link href={href("/pricing")}>
              {t.seePricing}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <ul className="grid gap-3 self-center">
          {t.replaces.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <Check className="size-3 text-primary" />
              </span>
              <span className="text-sm text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Publishing                                                                 */
/* -------------------------------------------------------------------------- */

/** Only what actually ships. The design shows a dozen logos we do not support. */
const PLATFORMS = ["WordPress", "Ghost", "Shopify"];

export function Publishing({ t }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.publishesTitle}{" "}
            <span className="text-primary">{t.publishesAccent}</span>{" "}
            {t.publishesTitleEnd}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.publishesSub}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.publishesPlugin}
          </p>
        </div>

        <div className="flex flex-wrap content-center gap-2.5">
          {[...PLATFORMS, t.platformOther].map((platform) => (
            <span
              key={platform}
              className="rounded-full border bg-card px-4 py-2 text-sm"
            >
              {platform}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* What you see                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the product tracks, in place of the design's customer result cards.
 *
 * The design shows four named businesses with figures like "855% increase in
 * impressions". Those are real customers of a real product; inventing
 * equivalents would be fabricating testimonials. This describes what a customer
 * will see in their own dashboard, which is honest and still concrete.
 */
const TRACKED_ICONS: LucideIcon[] = [BarChart3, Bot, Link2, FileText];

export function WhatYouSee({ t }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.trackedTitle}
        </h2>
        <p className="mt-4 max-w-lg text-muted-foreground">{t.trackedSub}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.tracked.map((item, index) => {
            const Icon = TRACKED_ICONS[index] ?? BarChart3;
            return (
              <Card key={item.label}>
                <CardContent className="py-6">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Backlink network                                                           */
/* -------------------------------------------------------------------------- */

export function BacklinkNetwork({ t, href }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {t.networkEyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.networkTitle}{" "}
          <span className="text-muted-foreground">{t.networkTitleRest}</span>
        </h2>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-medium">{t.networkHeading}</p>
            <ul className="mt-4 space-y-2.5">
              {t.networkPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10"
                    aria-hidden="true"
                  >
                    <Check className="size-3 text-primary" />
                  </span>
                  <span className="text-sm text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" asChild className="mt-6">
              <Link href={href("/backlink-exchange")}>
                {t.networkHowLink}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/30 p-6">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              {t.networkWhyTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.networkWhyBody}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */

export function ClosingCta({ t, href }: SectionProps) {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-10">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.closingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-primary-foreground/90">
          {t.closingSub}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" variant="secondary" asChild className={CTA}>
            <Link href={href("/audit")}>
              {t.checkFree}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-primary-foreground/90">
          <span className="flex items-center gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            {t.cancelAnytime}
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            {t.guarantee}
          </span>
        </p>
      </div>
    </section>
  );
}
