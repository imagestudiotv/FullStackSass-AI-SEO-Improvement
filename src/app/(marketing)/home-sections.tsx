import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  FileText,
  Link2,
  Play,
  PlayCircle,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-logo";
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
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.055] via-background to-background px-4 pt-16 pb-20 sm:pt-24">
      {/*
        The soft warm wash the design puts behind the cards. A radial tint
        rather than an image: it costs no request and scales to any width.
        Behind everything, so the cards and headline stay crisp on top.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(234,88,12,0.10), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {t.eyebrow}
        </p>

        {/*
          Two lines, the second in the brand colour, as drawn. The break is a
          <br /> rather than a wrap, so it falls in the same place at every
          width instead of only on a wide screen.
        */}
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {t.titleLead}
          <br />
          <span className="text-primary">{t.titleAccent}</span>
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
          className="mt-7 inline-flex items-center gap-2.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Play className="size-4 fill-current" aria-hidden="true" />
          </span>
          {t.seeHow}
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
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
        {/*
          The curved threads linking the cards back towards the middle.

          One SVG on a viewBox rather than six positioned elements: the curves
          have to meet the cards at the right angle, and expressing that as
          absolutely positioned divs would be six numbers to re-tune every time
          a card moves. preserveAspectRatio="none" lets the whole set stretch
          with the container, which is what keeps the ends attached.

          Decorative, so it is inside the aria-hidden wrapper and adds nothing
          for a screen reader.
        */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          fill="none"
        >
          <g
            stroke="currentColor"
            className="text-primary/25"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            strokeLinecap="round"
          >
            <path d="M232 132 C 300 150, 330 210, 372 250" />
            <path d="M212 300 C 290 300, 330 290, 372 285" />
            <path d="M236 452 C 300 440, 340 380, 378 330" />
            <path d="M768 128 C 700 148, 668 208, 628 248" />
            <path d="M788 300 C 710 300, 668 290, 628 285" />
            <path d="M764 452 C 700 440, 660 380, 622 330" />
          </g>
          {/* The small dots where each thread meets the centre. */}
          <g className="fill-primary/60">
            <circle cx="232" cy="132" r="4" />
            <circle cx="212" cy="300" r="4" />
            <circle cx="236" cy="452" r="4" />
            <circle cx="768" cy="128" r="4" />
            <circle cx="788" cy="300" r="4" />
            <circle cx="764" cy="452" r="4" />
          </g>
        </svg>

        {t.heroCards.map((card, index) => {
          const style = HERO_CARD_STYLE[index];
          const Icon = style.icon;
          return (
            <div
              key={card.label}
              className={`absolute w-52 rounded-2xl border border-black/[0.04] bg-card p-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18)] ${style.className}`}
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
/* Product preview                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard shot under the hero.
 *
 * The design puts a full product screenshot here, and it is the strongest
 * thing on the page: everything above it is a claim, and this is the first
 * evidence. Drawn in markup rather than shipped as an image, so it stays sharp
 * on any display, translates with the rest of the page, and does not go stale
 * the next time the real dashboard changes shape.
 *
 * The figures are ILLUSTRATIVE and the caption says so. Numbers in a product
 * shot are how a design communicates "there will be numbers here", and a
 * reader who takes 12 published articles as a promise has been misled, so the
 * caption removes the doubt rather than leaving it.
 */
const PREVIEW_STATS = [
  { value: "12", label: "Articles published", delta: "+71%" },
  { value: "28", label: "Backlinks built", delta: "+56%" },
  { value: "18", label: "Keywords improved", delta: "+83%" },
  { value: "4.2K", label: "Estimated traffic", delta: "+120%" },
];

const PREVIEW_NAV = [
  "Dashboard",
  "Content",
  "Backlinks",
  "Keywords",
  "Calendar",
  "Reports",
  "Settings",
];

export function ProductPreview({ t }: SectionProps) {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.3)]">
          <div className="flex">
            {/* Sidebar. Hidden on a phone, where it would eat half the frame. */}
            <div className="hidden w-44 shrink-0 border-r bg-muted/30 p-4 sm:block">
              <div className="flex items-center gap-2 px-1">
                <BrandMark size={18} />
                <span className="text-sm font-semibold">RepGet</span>
              </div>
              <ul className="mt-5 space-y-0.5">
                {PREVIEW_NAV.map((item, index) => (
                  <li
                    key={item}
                    className={`rounded-md px-2.5 py-1.5 text-xs ${
                      index === 0
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 flex-1 p-5">
              <p className="text-base font-semibold">{t.previewTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.previewSub}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PREVIEW_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-xl border p-3">
                    <p className="text-xl font-semibold tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-emerald-600">
                      {stat.delta}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium">Content calendar</p>
                  <ul className="mt-2 space-y-2">
                    {t.tracked.slice(0, 3).map((item) => (
                      <li
                        key={item.label}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                          {item.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium">SEO score</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-2xl font-semibold tabular-nums text-emerald-600">
                      97
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {t.pillars.slice(0, 3).map((pillar) => (
                        <p
                          key={pillar.title}
                          className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"
                        >
                          <Check
                            className="size-3 shrink-0 text-emerald-600"
                            aria-hidden="true"
                          />
                          {pillar.title}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t.previewCaption}
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Four pillars                                                               */
/* -------------------------------------------------------------------------- */

/** Order matches `pillars` in the dictionary. */
const PILLAR_ICONS: LucideIcon[] = [FileText, Link2, BarChart3, Sparkles];

export function Pillars({ t }: SectionProps) {
  return (
    <section className="px-4 pb-16">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
        {t.pillars.map((pillar, index) => {
          const Icon = PILLAR_ICONS[index] ?? FileText;
          return (
            <div
              key={pillar.title}
              /*
                Vertical rules between the columns, as drawn — but only from lg,
                where the four sit in one row. At sm they are two rows of two and
                a divider would fall in the middle of nothing.
              */
              className="px-6 text-center lg:border-l lg:first:border-l-0"
            >
              <Icon
                className="mx-auto size-7 text-primary"
                aria-hidden="true"
              />
              <p className="mt-3 font-semibold">{pillar.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {pillar.body}
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
