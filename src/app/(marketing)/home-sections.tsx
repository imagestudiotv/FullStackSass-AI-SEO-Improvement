import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  FileText,
  LayoutDashboard,
  Link2,
  Play,
  PlayCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";
import { AuditQuickForm } from "./audit-quick-form";
import {
  GhostMark,
  SearchConsoleMark,
  ShopifyMark,
  WebflowMark,
  WebhookMark,
  WixMark,
  WordPressMark,
} from "@/components/integration-marks";
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
  { icon: Search, className: "left-[3%] top-4 -rotate-6" },
  { icon: Bot, className: "left-[0%] top-32 rotate-3" },
  { icon: Users, className: "left-[4%] top-[14rem] -rotate-3" },
  { icon: Sparkles, className: "right-[3%] top-2 rotate-6" },
  { icon: Link2, className: "right-[0%] top-32 -rotate-3" },
  { icon: TrendingUp, className: "right-[4%] top-[14rem] rotate-3" },
];

/** The shared lg size is h-9 — right for a form, too small for a hero. */
const CTA = "h-12 rounded-full px-7 text-base";

export function Hero({ t, href }: SectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.055] via-background to-background px-4 pt-14 pb-12 sm:pt-20">
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
        {/*
          The design opens on the headline. The eyebrow that used to sit here
          said the same thing in smaller type and cost a line of height the
          hero does not have to spare — the phrasing survives in the page
          metadata, which is where it actually earns its keep.
        */}
        {/*
          Two lines, the second in the brand colour, as drawn. The break is a
          <br /> rather than a wrap, so it falls in the same place at every
          width instead of only on a wide screen.
        */}
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {t.titleLead}
          <br />
          <span className="text-primary">{t.titleAccent}</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
          {t.subtitle}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
        <p className="mt-4 text-sm text-muted-foreground">{t.noCard}</p>

        {/*
          Scrolls to the demo rather than opening a modal: a video that takes
          over the screen on a phone is the behaviour we just spent two commits
          removing from the chat widget.
        */}
        <a
          href="#how-it-works-video"
          className="mt-5 inline-flex items-center gap-2.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
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
        /*
          Inset from the top rather than pinned to it.

          The cards are positioned against this layer, so a card at top-0 sat
          at the section's very top edge — which begins directly beneath the
          sticky header, and the two topmost cards slid under it. Starting the
          layer below the header means no card can reach it however these
          offsets are tuned later.
        */
        className="pointer-events-none absolute inset-x-0 top-6 mx-auto hidden h-full max-w-7xl xl:block"
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
          viewBox="0 0 1000 420"
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
            <path d="M258 74 C 310 92, 336 132, 360 170" />
            <path d="M244 196 C 300 200, 330 198, 356 198" />
            <path d="M262 300 C 312 292, 342 262, 366 232" />
            <path d="M742 70 C 690 88, 664 130, 640 168" />
            <path d="M756 196 C 700 200, 670 198, 644 198" />
            <path d="M738 300 C 688 292, 658 262, 634 232" />
          </g>
          {/* The small dots where each thread meets the centre. */}
          <g className="fill-primary/60">
            <circle cx="258" cy="74" r="3.5" />
            <circle cx="244" cy="196" r="3.5" />
            <circle cx="262" cy="300" r="3.5" />
            <circle cx="742" cy="70" r="3.5" />
            <circle cx="756" cy="196" r="3.5" />
            <circle cx="738" cy="300" r="3.5" />
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
/**
 * The rows of the mock, kept as data so the markup below stays readable.
 *
 * Deliberately generic subject matter: the design uses a travel business
 * ("Best Restaurants in Positano"), which reads as a real customer's calendar
 * to anyone who does not know it is a mock. These are the kind of article any
 * small business would recognise as their own.
 */
const PREVIEW_STATS = [
  { value: "12", label: "Articles published", delta: "+71%", icon: FileText },
  { value: "28", label: "Backlinks built", delta: "+56%", icon: Link2 },
  { value: "18", label: "Keywords improved", delta: "+83%", icon: Search },
  { value: "4.2K", label: "Estimated traffic", delta: "+120%", icon: BarChart3 },
];

const PREVIEW_NAV: { label: string; icon: LucideIcon }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Content", icon: FileText },
  { label: "Backlinks", icon: Link2 },
  { label: "Keywords", icon: Search },
  { label: "Calendar", icon: CalendarDays },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

/**
 * Status colours match the real product: draft is neutral, generating is the
 * brand orange because something is happening, planned is blue. Someone who
 * signs up should recognise this screen.
 */
const PREVIEW_CALENDAR = [
  { month: "SEP", day: "14", title: "How to choose a supplier", status: "Draft", tone: "bg-muted text-muted-foreground" },
  { month: "SEP", day: "16", title: "What our prices include", status: "Generating", tone: "bg-primary/10 text-primary" },
  { month: "SEP", day: "18", title: "Five questions to ask first", status: "Planned", tone: "bg-blue-500/10 text-blue-600" },
  { month: "SEP", day: "20", title: "A guide for first-time buyers", status: "Planned", tone: "bg-blue-500/10 text-blue-600" },
];

const PREVIEW_SEO_CHECKS = [
  "Keyword optimised",
  "Meta description",
  "Internal links",
  "Image SEO",
  "Readability",
];

/**
 * The SEO score arc.
 *
 * An SVG semicircle rather than a conic gradient: the reference has rounded
 * ends on the stroke, and strokeLinecap gives that for free where a gradient
 * would need masking. The dash offset is computed from the score, so changing
 * the number moves the arc.
 */
function ScoreArc({ score }: { score: number }) {
  // Half circle, radius 52, so the drawn length is pi * r.
  const length = Math.PI * 52;
  return (
    <div className="relative mx-auto w-[132px]">
      <svg viewBox="0 0 132 74" className="w-full" aria-hidden="true">
        <path
          d="M14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke="currentColor"
          className="text-emerald-500"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - score / 100)}
        />
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center text-xl font-semibold tabular-nums">
        {score}
        <span className="text-sm text-muted-foreground">/100</span>
      </p>
    </div>
  );
}

export function ProductPreview({ t }: SectionProps) {
  return (
    <section className="px-4 pb-10">
      <div className="mx-auto max-w-6xl">
        {/*
          The grey device frame from the design — a padded outer shell with the
          app inset inside it, which is what makes the mock read as a screen
          rather than as more page.
        */}
        <div className="rounded-[1.75rem] border bg-muted/50 p-2 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.35)] sm:p-3">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {/* App chrome: brand on the left, account controls on the right. */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <BrandMark size={18} />
                <span className="text-sm font-semibold">RepGet</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Plus className="size-4" aria-hidden="true" />
                <UserRound className="size-4" aria-hidden="true" />
              </div>
            </div>

            <div className="flex">
              {/* Sidebar. Hidden on a phone, where it would eat half the frame. */}
              <div className="hidden w-44 shrink-0 border-r p-3 lg:block">
                <ul className="space-y-0.5">
                  {PREVIEW_NAV.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.label}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
                          index === 0
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                        {item.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{t.previewTitle}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.previewSub}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                    Last 30 days
                    <ChevronDown className="size-3" aria-hidden="true" />
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {PREVIEW_STATS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xl font-semibold tabular-nums">
                            {stat.value}
                          </p>
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                            <Icon
                              className="size-3.5 text-primary"
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <TrendingUp className="size-3" aria-hidden="true" />
                          {stat.delta}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {/* Content calendar, with the date blocks from the design. */}
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Content calendar</p>
                      <span className="flex items-center gap-1 text-xs text-primary">
                        View all
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </span>
                    </div>
                    <ul className="mt-2 divide-y">
                      {PREVIEW_CALENDAR.map((row) => (
                        <li
                          key={row.title}
                          className="flex items-center gap-3 py-2"
                        >
                          <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-muted py-1">
                            <span className="text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                              {row.month}
                            </span>
                            <span className="text-sm leading-none font-semibold">
                              {row.day}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs">
                              {row.title}
                            </span>
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${row.tone}`}
                            >
                              {row.status}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Latest article and its score, side by side as drawn. */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">Latest article</p>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-600">
                          Published
                        </span>
                      </div>
                      {/*
                        A tinted block rather than a stock photograph: the
                        design shows a generated article image, and shipping a
                        real photo here would be a picture of a place no
                        customer of ours has written about.
                      */}
                      <div
                        className="mt-2 aspect-[16/9] rounded-lg bg-gradient-to-br from-primary/25 via-primary/10 to-blue-500/20"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs leading-snug font-medium">
                        The complete guide for 2026
                      </p>
                      <p className="mt-1 line-clamp-2 text-[0.65rem] leading-relaxed text-muted-foreground">
                        Written from what your customers actually search for,
                        then published to your own site.
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.65rem]">
                        View article
                        <ArrowRight className="size-2.5" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="rounded-xl border p-3">
                      <p className="text-xs font-semibold">SEO score</p>
                      <div className="mt-1">
                        <ScoreArc score={97} />
                      </div>
                      <ul className="mt-2 space-y-1">
                        {PREVIEW_SEO_CHECKS.map((check) => (
                          <li
                            key={check}
                            className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground"
                          >
                            <CircleCheck
                              className="size-3 shrink-0 text-emerald-600"
                              aria-hidden="true"
                            />
                            {check}
                          </li>
                        ))}
                      </ul>
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
    <section className="px-4 pb-8">
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
 * The integrations grid under the hero.
 *
 * The design has "TRUSTED BY BUSINESSES WORLDWIDE" over Google, Shopify,
 * Stripe, Airbnb, Samsung and Adobe. None of them are customers, and putting
 * their marks under that sentence claims an endorsement we do not have — the
 * kind of claim a prospect can check in one search, on the page where they are
 * deciding whether to believe anything else we say.
 *
 * Same band, true sentence: these are the platforms articles actually publish
 * to and the account rankings are actually read from. Each one is a real
 * adapter in the provider registry, so a card here is something a customer can
 * connect today rather than a name on a roadmap.
 *
 * The mockup for this grid draws ten tiles, including Framer, Notion,
 * WordPress.com and a Next.js starter. Those four ship no adapter — nothing
 * publishes to them — so they are left out rather than drawn as working
 * integrations. Adding one is a provider in the registry, a doc page, and a
 * card here; the grid reflows on its own.
 */
const WORKS_WITH: {
  name: string;
  detail: string;
  Mark: (props: { className?: string }) => React.ReactElement;
  /** Brand tint behind the mark, as the design tiles them. */
  tone: string;
  /** The setup guide, when the integration has one. */
  slug?: string;
}[] = [
  {
    name: "WordPress",
    detail: "Publish to any self-hosted WP site",
    Mark: WordPressMark,
    tone: "bg-[#21759b]/10 text-[#21759b]",
    slug: "wordpress",
  },
  {
    name: "Webflow",
    detail: "Sync to CMS collections",
    Mark: WebflowMark,
    tone: "bg-[#4353ff]/10 text-[#4353ff]",
    slug: "webflow",
  },
  {
    name: "Shopify",
    detail: "Power store blogs",
    Mark: ShopifyMark,
    tone: "bg-[#95bf47]/15 text-[#5e8e3e]",
    slug: "shopify",
  },
  {
    name: "Ghost",
    detail: "Native Ghost Admin API",
    Mark: GhostMark,
    tone: "bg-foreground/10 text-foreground",
    slug: "ghost",
  },
  {
    name: "Wix",
    detail: "Push to your Wix blog",
    Mark: WixMark,
    tone: "bg-[#0c6efd]/10 text-[#0c6efd]",
    slug: "wix",
  },
  {
    name: "Webhook",
    detail: "Connect anything else",
    Mark: WebhookMark,
    tone: "bg-primary/10 text-primary",
    slug: "webhook",
  },
  {
    name: "Search Console",
    detail: "Read your real rankings",
    Mark: SearchConsoleMark,
    tone: "bg-[#458cf5]/10 text-[#458cf5]",
  },
];

export function WorksWith({ t, href }: SectionProps) {
  return (
    <section className="border-t px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t.worksWithTitle}
        </p>

        {/*
          Tiles rather than a row of words, as the grid in the design draws
          them. Four across at desktop and two on a phone: five columns would
          leave the last card alone on its own row, since there are seven.
        */}
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {WORKS_WITH.map(({ name, detail, Mark, tone, slug }) => {
            /*
              A card is a link only when there is a guide to open. Search
              Console has no setup page of its own — it is connected from
              inside the account — and a card that looks clickable and does
              nothing is worse than one that plainly does not.
            */
            const card = (
              <>
                <span
                  className={`flex size-11 items-center justify-center rounded-xl ${tone}`}
                >
                  <Mark className="size-6" />
                </span>
                <span className="mt-3 block font-medium">{name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {detail}
                </span>
              </>
            );

            return (
              <li key={name}>
                {slug ? (
                  <Link
                    href={href(`/docs/integrations/${slug}`)}
                    className="flex h-full flex-col items-center rounded-2xl border bg-card p-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
                  >
                    {card}
                  </Link>
                ) : (
                  <div className="flex h-full flex-col items-center rounded-2xl border bg-card p-5 text-center">
                    {card}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Free-with-your-audit band                                                  */
/* -------------------------------------------------------------------------- */

/** Order matches auditItems in the dictionary. */
const AUDIT_ICONS: LucideIcon[] = [Search, BarChart3, Link2];

export function AuditBand({ t, href }: SectionProps) {
  return (
    <section className="px-4 pb-20">
      {/*
        The glow the design puts behind this card. It is the page's primary
        conversion point, and the surrounding sections are plain, so a tinted
        ring is what separates it from the rest rather than making it louder.
      */}
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl bg-gradient-to-b from-primary/25 to-primary/5 p-[1.5px] shadow-[0_24px_70px_-30px_rgba(234,88,12,0.35)]">
          <div className="rounded-3xl bg-card p-6 sm:p-8">
            <p className="text-center text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {t.auditBand}
            </p>

            <div className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-0">
              {t.auditItems.map((item, index) => {
                const Icon = AUDIT_ICONS[index] ?? Search;
                return (
                  <div
                    key={item.title}
                    /*
                      Dividers only from sm, where the three sit in a row. At
                      phone width they stack and a vertical rule would fall
                      between nothing.
                    */
                    className="sm:px-5 sm:not-first:border-l"
                  >
                    <p className="flex items-start gap-2 font-semibold">
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="text-primary">{index + 1}.</span>{" "}
                        {item.title}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>

            {/*
              A real field, as the design draws it — but it only carries the
              domain to /audit rather than running anything here. That page
              owns the validation, the SSRF guard and the caching; a second
              entry point that did its own crawling would be a second copy of
              all of it, and the two would drift.
            */}
            <div className="mt-8">
              <AuditQuickForm
                placeholder={t.auditPlaceholder}
                cta={t.checkMyWebsite}
                action={href("/audit")}
              />
            </div>
          </div>
        </div>

        {/* The two reassurances from the design, under the card. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {t.auditAssurances.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded bg-emerald-500/15">
                <Check
                  className="size-3 text-emerald-600"
                  aria-hidden="true"
                />
              </span>
              {item}
            </span>
          ))}
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
              overflow-hidden - it needs it so images clip to the rounded
              corners - so a badge positioned outside the card is cut in half
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
