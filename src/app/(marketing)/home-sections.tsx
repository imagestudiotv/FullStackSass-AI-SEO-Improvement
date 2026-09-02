import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileText,
  Link2,
  Search,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Homepage sections, following the supplied landing design.
 *
 * The design is built around a product with customers: it shows "trusted by
 * 10,000+ marketers", named case studies with 855% growth, and a comparison
 * table pricing nine named competitors. None of that is true here yet, and a
 * fake testimonial is the fastest way to lose a real customer — so the
 * structure is the design's and the content is what we can stand behind.
 *
 * Where a section depends entirely on claims we cannot make (the customer
 * result cards, the "trusted by" row), it is left out rather than filled with
 * invented numbers. Those are marked below so they can be added the moment
 * there are real figures.
 */

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The floating stat cards from the design.
 *
 * These illustrate what the product tracks rather than claiming results. The
 * design's versions carry specific numbers ("65 positions", "3,500 organic
 * traffic") which would read as our customers' actual figures, so these show
 * the metric and leave the number to the customer's own dashboard.
 */
const HERO_CARDS: {
  icon: LucideIcon;
  label: string;
  detail: string;
  className: string;
}[] = [
  {
    icon: Search,
    label: "Google rankings",
    detail: "Tracked daily",
    className: "left-[6%] top-10 -rotate-6",
  },
  {
    icon: Bot,
    label: "AI assistants",
    detail: "Are you cited?",
    className: "left-[2%] top-56 rotate-3",
  },
  {
    icon: Link2,
    label: "Backlinks",
    detail: "Earned, not bought",
    className: "right-[6%] top-8 rotate-6",
  },
  {
    icon: FileText,
    label: "Articles",
    detail: "Written and published",
    className: "right-[2%] top-60 -rotate-3",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Get ranked. Get cited. Get recommended.
        </p>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Get found everywhere your customers search
          <span className="text-primary">.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          Rank on Google. Get recommended by AI assistants. Build authority with
          content and backlinks, automatically.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            asChild
            className="h-12 rounded-full px-7 text-base"
          >
            <Link href="/audit">
              Check my website free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 rounded-full px-7 text-base"
          >
            <Link href="/sign-up">Start for free</Link>
          </Button>
        </div>

        {/*
          The design has a "Trusted by 10,000+ marketers" row with avatars and
          five stars here. Left out until it is true — see the note at the top
          of this file. What replaces it is a real fact.
        */}
        <p className="mt-6 text-sm text-muted-foreground">
          No card required to run your first check.
        </p>
      </div>

      {/*
        Floating cards, hidden below xl. At narrower widths they would either
        overlap the headline or stack into a meaningless list.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-full max-w-6xl xl:block"
        aria-hidden="true"
      >
        {HERO_CARDS.map((card) => (
          <div
            key={card.label}
            className={`absolute w-48 rounded-xl border bg-card p-3.5 shadow-lg ${card.className}`}
          >
            <div className="flex items-center gap-2">
              <card.icon className="size-4 text-primary" />
              <span className="text-xs font-medium">{card.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Free-with-your-audit band                                                  */
/* -------------------------------------------------------------------------- */

const AUDIT_INCLUDES = [
  {
    icon: Search,
    title: "SEO & AI audit",
    body: "See your site's health, what is missing, and whether AI assistants mention you.",
  },
  {
    icon: TrendingUp,
    title: "A plan to act on",
    body: "The specific changes worth making, in the order worth making them.",
  },
  {
    icon: Link2,
    title: "Your first backlink",
    body: "One link from a real business in a related field, earned rather than bought.",
  },
];

export function AuditBand() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Free with your audit
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {AUDIT_INCLUDES.map((item, index) => (
            <div key={item.title} className="sm:px-2">
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
            <Link href="/audit">
              Check my website
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

const STEPS = [
  {
    title: "Audit",
    body: "We read your website, find what is holding it back, and check whether AI assistants mention you.",
  },
  {
    title: "Connect",
    body: "Link your site — WordPress, Ghost, Shopify or a webhook — so we can publish for you.",
  },
  {
    title: "Grow",
    body: "We research, write and publish, then show you what actually changed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            /*
              The badge sits on a WRAPPER rather than on the Card. Card carries
              overflow-hidden — it needs it so images clip to the rounded
              corners — so a badge positioned outside the card is cut in half
              at the border. Overlapping the wrapper instead keeps the card's
              clipping intact and lets the badge hang over the edge.
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
 * The design's two-column problem-and-solution section.
 *
 * Problems on the left as separate cards, our answer on the right as one solid
 * orange panel. The asymmetry is the point: three scattered complaints against
 * one consolidated answer is the argument the section is making, and centring
 * it would flatten that into a list.
 *
 * The design puts a customer photo beside each problem. Those are real people
 * from a real product, so these carry no avatars rather than stock faces
 * pretending to be customers.
 */
const PROBLEMS = [
  "Paid ads drain your budget every month — and stop the moment you do.",
  "Hours lost juggling audits, keywords, content and a stack of separate tools.",
  "AI assistants recommend your competitors, and you never find out.",
];

const SOLUTION = [
  "Full SEO and AI-readiness audit",
  "AI visibility tracking across assistants",
  "Keyword and market research",
  "Articles written for you, published automatically",
  "Backlinks earned from real businesses",
];

export function ProblemSolution() {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Problems &amp; solution
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your problem
          <br />
          <span className="text-primary">Our solution</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="space-y-4">
            {PROBLEMS.map((problem) => (
              <div key={problem} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{problem}</p>
              </div>
            ))}
          </div>

          {/*
            One solid panel against three separate cards. The visual weight is
            the argument: scattered problems, one consolidated answer.
          */}
          <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
            <p className="font-medium">Everything you need, in one place</p>
            <ul className="mt-5 space-y-3">
              {SOLUTION.map((item) => (
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
 * What the subscription covers.
 *
 * The design shows this as a table pricing nine named competitors against us,
 * totalling "$1,140+/mo". Those are other companies' prices, they change
 * without telling us, and getting one wrong in our favour is the kind of claim
 * that ends in a complaint. This lists what we do instead, which is the part
 * we can stand behind.
 */
const REPLACES = [
  "SEO audit and site crawl",
  "AI visibility tracking",
  "Keyword and market research",
  "Written, optimised articles",
  "Publishing to your CMS",
  "Backlink building",
  "Search Console and Analytics reporting",
];

export function OneSubscription() {
  return (
    <section className="border-t px-4 py-20">
      {/*
        Two columns rather than a centred stack. The design keeps its section
        headings on the left with content beside or below them; centring
        everything was flattening that into one narrow column down the middle.
      */}
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Us vs. a stack of tools
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One subscription replaces{" "}
            <span className="text-primary">your whole SEO stack</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Audit, AI visibility, research, content, publishing, backlinks and
            reporting — in one place, for less than the tools cost separately.
          </p>
          <Button asChild className="mt-7">
            <Link href="/pricing">
              See pricing
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <ul className="grid gap-3 self-center">
          {REPLACES.map((item) => (
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
const PLATFORMS = ["WordPress", "Ghost", "Shopify", "Any site via webhook"];

export function Publishing() {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Publishes <span className="text-primary">directly</span> to your
            site
          </h2>
          <p className="mt-4 text-muted-foreground">
            Connect once. No manual uploads, no copy-paste — articles appear on
            your site automatically, with their images.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Our WordPress plugin connects with one key, and works even if your
            host blocks the WordPress API.
          </p>
        </div>

        <div className="flex flex-wrap content-center gap-2.5">
          {PLATFORMS.map((platform) => (
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
/* Backlink network                                                           */
/* -------------------------------------------------------------------------- */

const NETWORK_POINTS = [
  "Every customer both gives and receives links",
  "Links come from businesses in a related field, never unrelated ones",
  "Placed inside real articles, not a page of links",
  "Checked daily — if a link is removed, your credit comes back",
];

export function BacklinkNetwork() {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          A vetted backlink network
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
          A backlink network{" "}
          <span className="text-muted-foreground">
            that gets stronger with every new customer.
          </span>
        </h2>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-medium">Automated link exchange</p>
            <ul className="mt-4 space-y-2.5">
              {NETWORK_POINTS.map((point) => (
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
              <Link href="/backlink-exchange">
                How the exchange works
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/30 p-6">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Why exchange rather than buy
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Buying links is against Google&apos;s guidelines and can be
              penalised. Every link here sits in a real article on a real
              business&apos;s site, published because that business wanted the
              article — which is why the network works by exchange.
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

export function ClosingCta() {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-10">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Start growing on autopilot today
        </h2>
        <p className="mx-auto mt-3 max-w-md text-primary-foreground/90">
          Run a free check on your website and see what is holding it back. No
          account needed.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            asChild
            className="h-12 rounded-full px-7 text-base"
          >
            <Link href="/audit">
              Check my website free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-primary-foreground/90">
          <span className="flex items-center gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            Cancel any time
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4" aria-hidden="true" />
            14-day money-back guarantee
          </span>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Metrics strip                                                              */
/* -------------------------------------------------------------------------- */

/**
 * What the product tracks, in place of the design's customer result cards.
 *
 * The design shows four named businesses with figures like "855% increase in
 * impressions". Those are real customers of a real product; inventing
 * equivalents would be fabricating testimonials. This describes what a
 * customer will see in their own dashboard instead, which is honest and still
 * concrete.
 */
const TRACKED = [
  {
    icon: BarChart3,
    label: "Rankings and clicks",
    detail: "From Search Console",
  },
  { icon: Bot, label: "AI visibility", detail: "Whether assistants name you" },
  { icon: Link2, label: "Backlinks earned", detail: "Checked every day" },
  { icon: FileText, label: "Articles published", detail: "And what they did" },
];

export function WhatYouSee() {
  return (
    <section className="border-t px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          You see exactly what changed
        </h2>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Not a monthly PDF. A dashboard reading your own Search Console and
          Analytics data.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKED.map((item) => (
            <Card key={item.label}>
              <CardContent className="py-6">
                <item.icon className="size-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
