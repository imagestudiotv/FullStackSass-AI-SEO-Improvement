import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileText,
  Link2,
  PlayCircle,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";
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
/**
 * Where each floating card sits, in the order the dictionary lists them.
 *
 * Six rather than four: three down each side, so the headline keeps a clear
 * column through the middle. The vertical spread is deliberate — evenly
 * spaced cards read as a list, while staggered ones read as a scatter, which
 * is what the design is doing.
 *
 * Icons live here and words live in the dictionary, because an icon is not
 * translatable and a component name in a messages file is something a
 * translator could break the build with.
 */
const HERO_CARD_STYLE: { icon: LucideIcon; className: string }[] = [
  { icon: Search, className: "left-[4%] top-8 -rotate-6" },
  { icon: Bot, className: "left-[0%] top-44 rotate-3" },
  { icon: Users, className: "left-[5%] top-[19rem] -rotate-3" },
  { icon: Sparkles, className: "right-[4%] top-6 rotate-6" },
  { icon: Link2, className: "right-[0%] top-44 -rotate-3" },
  { icon: TrendingUp, className: "right-[5%] top-[19rem] rotate-3" },
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
          {/*
            Google beside the free check, as the design asks. It goes to the
            same sign-up page as everything else rather than starting an OAuth
            flow from here: that page offers Google AND email, so someone who
            clicks this and then changes their mind is not stranded on a screen
            with one option. Sign-up is not localised, so it keeps its own path.
          */}
          <Button size="lg" variant="outline" asChild className={CTA}>
            <Link href="/sign-up">
              <GoogleMark />
              {t.joinGoogle}
            </Link>
          </Button>
        </div>

        {/*
          The design puts a "Google 4.9/5" badge here. Left out until there are
          real reviews to average: a rating is a checkable claim, and an
          invented one on the page where someone decides to trust us is the
          kind of thing that ends a deal rather than starting one. The row
          below says something true instead.
        */}
        <p className="mt-6 text-sm text-muted-foreground">{t.noCard}</p>

        {/*
          Scrolls to the demo rather than opening a modal: a video that takes
          over the screen on a phone is the behaviour we just spent two commits
          removing from the chat widget.
        */}
        <a
          href="#how-it-works-video"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          <PlayCircle className="size-7 text-primary" aria-hidden="true" />
          {t.seeHow}
        </a>
      </div>

      {/*
        Floating cards, hidden below xl. At narrower widths they would either
        overlap the headline or stack into a meaningless list.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-full max-w-7xl xl:block"
        aria-hidden="true"
      >
        {t.heroCards.map((card, index) => {
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
/* Demo video                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The walkthrough the hero's "See how it works" scrolls to.
 *
 * A placeholder frame until there is a video to put in it. Deliberately not a
 * stock clip or a silent screen recording of a half-built product: a demo that
 * shows something other than what the customer will get is worse than a panel
 * saying the video is coming, and the free check is a stronger offer than a
 * video anyway, so that is what the panel points at.
 *
 * WHEN THE VIDEO EXISTS: drop a <video> or an embed in place of the
 * placeholder div. The frame, the heading and the scroll target are already
 * right, so nothing else on the page has to change.
 */
export function DemoVideo({ t, href }: SectionProps) {
  return (
    <section
      id="how-it-works-video"
      className="scroll-mt-20 border-t px-4 py-20"
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.videoTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t.videoSub}
        </p>

        {/*
          16:9 with the aspect-ratio box rather than a fixed height, so the
          frame keeps its shape from a phone up to a desktop and the real video
          drops in without the surrounding layout shifting.
        */}
        <div className="mt-10 overflow-hidden rounded-2xl border bg-muted/40 shadow-sm">
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 p-8">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <PlayCircle
                className="size-8 text-primary"
                aria-hidden="true"
              />
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              {t.videoComingSoon}
            </p>
            <Button variant="outline" asChild>
              <Link href={href("/audit")}>
                {t.checkFree}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Works-with band                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The integration row under the hero.
 *
 * The design has "TRUSTED BY BUSINESSES WORLDWIDE" over Google, Shopify,
 * Stripe, Airbnb, Samsung and Adobe. None of them are customers, and putting
 * their marks under that sentence claims an endorsement we do not have — the
 * kind of claim a prospect can check in one search, on the page where they are
 * deciding whether to believe anything else we say.
 *
 * Same band, same rhythm, true sentence: these are the platforms articles
 * actually publish to and the account rankings are actually read from. Names
 * as text rather than logos, because using a logo is a trademark question even
 * when the integration is real.
 */
const WORKS_WITH = [
  "WordPress",
  "Shopify",
  "Ghost",
  "Webflow",
  "Search Console",
];

export function WorksWith({ t }: SectionProps) {
  return (
    <section className="border-t px-4 py-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t.worksWithTitle}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {WORKS_WITH.map((name) => (
            <li
              key={name}
              className="text-lg font-semibold text-muted-foreground/70"
            >
              {name}
            </li>
          ))}
        </ul>
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
    /*
      #traffic-recovery: the Platform menu's "Traffic Recovery". This section
      is about pages losing ground and what to do, which is the nearest thing
      the homepage says about declining traffic.
    */
    <section
      id="traffic-recovery"
      className="scroll-mt-20 border-t px-4 py-20"
    >
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
    // #content-engine: the Platform menu's "Content Engine" lands here.
    <section
      id="content-engine"
      className="scroll-mt-20 border-t px-4 py-20"
    >
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
    /*
      #tracking: both "Search Performance" and "AI Presence" point here.
      This section covers rankings from Search Console AND whether assistants
      name you, so one target is honest rather than a compromise — splitting
      it would mean two anchors on the same list of cards.
    */
    <section id="tracking" className="scroll-mt-20 border-t px-4 py-20">
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
    // #authority-network: the Platform menu's "Authority Network".
    <section
      id="authority-network"
      className="scroll-mt-20 border-t px-4 py-20"
    >
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
