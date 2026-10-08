import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  Link2,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";
import { AuditQuickForm } from "./audit-quick-form";
import { ArticleExamples } from "./article-examples";
import { WalkthroughPlayer } from "./walkthrough-player";
import {
  GhostMark,
  SearchConsoleMark,
  ShopifyMark,
  WebflowMark,
  WebhookMark,
  WixMark,
  WordPressMark,
} from "@/components/integration-marks";
import { WideScreenOnly } from "@/components/wide-screen-only";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { walkthroughWatchUrl } from "@/lib/marketing/walkthrough";

/**
 * Homepage sections, following the supplied landing design.
 *
 * Every section takes its copy as a prop rather than hardcoding English. The
 * localised homepage used to be a separate, much simpler page — /es rendered
 * one section where / rendered nine — and the two drifted apart the moment the
 * English one was redesigned. Rendering both from these components (composed
 * once, in home-page.tsx) means a section added here appears in every
 * language.
 *
 * The design is built around a product with customers: "trusted by 10,000+
 * marketers", named case studies with 855% growth, a table pricing nine named
 * competitors. None of that is true here yet, and a fake testimonial is the
 * fastest way to lose a real customer — so the structure is the design's and
 * the content is what we can stand behind. Every drawing with figures in it
 * carries an "Example" label, and the sections that need real customer
 * material (testimonials) render nothing until it exists.
 */
export type SectionProps = {
  t: Messages["home"];
  /** Builds locale-aware paths: unchanged on English, prefixed on /es. */
  href: (path: string) => string;
};

/** The shared lg size is h-9 — right for a form, too small for a hero. */
const CTA = "h-12 rounded-full px-7 text-base";

/**
 * The warm off-white behind every other section. Alternating it with plain
 * white gives the long page a rhythm without a border between every block,
 * and keeps the tint restrained enough that white cards still lift off it.
 */
const TINT = "bg-primary/[0.025]";

/**
 * For every section below the first screen: the browser skips their style,
 * layout and paint until they come near the viewport.
 *
 * On PageSpeed's slow phone, laying out the whole 10,000px page at load was
 * about a second of main-thread work, though only the hero is on screen. The
 * text stays in the HTML (search engines and AI crawlers read it as before);
 * only the rendering waits. The size reserves a typical section height until
 * the real one is known (about 720px on a phone, 480px side by side on a
 * wide screen), and the browser remembers it afterwards, so the scrollbar
 * barely moves. A jump straight to a section switches all of this off first,
 * so it lands exactly: data-render-all after a "#" link, back/forward or a
 * resize (components/render-all-on-jump.tsx), and html:has(:target) for a
 * page opened on a section ("/#pricing" from a shared link) - plain CSS, so
 * it applies from the first layout with no script in front of the content.
 * Exported for the pricing, FAQ and testimonial blocks, which live in their
 * own files.
 */
export const OFFSCREEN =
  "[content-visibility:auto] [contain-intrinsic-size:auto_720px] lg:[contain-intrinsic-size:auto_480px] [[data-render-all]_&]:[content-visibility:visible] [html:has(:target)_&]:[content-visibility:visible]";

/**
 * The same, sized for the tall sections - the article examples, the
 * dashboard and the analytics cards run 1,000-1,700px - so the estimate is
 * close and the scrollbar does not jump when they render.
 */
export const OFFSCREEN_TALL =
  "[content-visibility:auto] [contain-intrinsic-size:auto_1400px] lg:[contain-intrinsic-size:auto_900px] [[data-render-all]_&]:[content-visibility:visible] [html:has(:target)_&]:[content-visibility:visible]";

/**
 * One heading style for every section: optional eyebrow, the h2 with an
 * optional orange accent, and a supporting line. Centred or left-aligned.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  sub,
  center = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  sub?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={`${center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`${eyebrow ? "mt-3" : ""} text-3xl font-semibold tracking-tight text-balance sm:text-4xl`}
      >
        {title}
        {accent ? (
          <>
            {" "}
            <span className="text-primary">{accent}</span>
          </>
        ) : null}
      </h2>
      {sub ? (
        <p className={`mt-4 text-pretty text-muted-foreground sm:text-lg ${center ? "mx-auto max-w-xl" : ""}`}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Marks a drawing as an illustration. Every drawing with figures carries one. */
function ExampleChip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`rounded-full border bg-background/90 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground ${className}`}
    >
      {label}
    </span>
  );
}

/** The card surface shared by the sections: white, hairline border, soft lift. */
const CARD =
  "rounded-2xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-20px_rgba(0,0,0,0.18)]";

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where each floating card sits, in the order the dictionary lists them.
 *
 * Six rather than four: three down each side, so the headline keeps a clear
 * column through the middle. The vertical spread is deliberate — evenly
 * spaced cards read as a list, while staggered ones read as a scatter, which
 * is what the design is doing.
 *
 * The cards name what the product tracks rather than claiming results: the
 * design's versions carry specific numbers ("65 positions") which would read
 * as a customer's actual figures.
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
          "Free website check • No credit card required • Results in minutes".
          Dots between the three from md, where the line fits; below that each
          wraps as its own item with a tick, so a phone never shows a dot
          stranded at the start of a line. (The design's "Google 4.9/5" badge
          stays out until there are real reviews to average.)
        */}
        <ul className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground md:max-w-none md:gap-x-2.5">
          {t.heroAssurances.map((item, index) => (
            <li key={item} className="flex items-center gap-1.5 md:gap-2.5">
              {index > 0 ? (
                <span aria-hidden="true" className="hidden text-primary/70 md:inline">
                  •
                </span>
              ) : null}
              <Check className="size-3.5 text-primary md:hidden" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        {/*
          Scrolls to the walkthrough rather than opening a modal, and does not
          start it: the video plays only from its own play button.
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
        Floating cards, wide screens only, in the DOM too (see WideScreenOnly):
        a phone never builds or hydrates these cards. They appear just after
        hydration on a wide screen, so they fade in rather than pop. The
        xl:block below still decides what shows if a window is resized across
        the breakpoint.
      */}
      <WideScreenOnly>
      <div
        /*
          Inset from the top rather than pinned to it, so no card can slide
          under the sticky header however these offsets are tuned later.
        */
        className="pointer-events-none absolute inset-x-0 top-6 mx-auto hidden h-full max-w-7xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 xl:block"
        aria-hidden="true"
      >
        {/*
          The curved threads linking the cards back towards the middle. One
          SVG on a viewBox rather than six positioned elements, stretched with
          the container so the ends stay attached.
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
          if (!style) return null;
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
              <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
            </div>
          );
        })}
      </div>
      </WideScreenOnly>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Walkthrough video                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The two-minute walkthrough, directly under the hero; the hero's "See how it
 * works" scrolls here. The player loads only when someone presses play (see
 * walkthrough-player.tsx); the id lives in lib/marketing/walkthrough.ts.
 *
 * "Watch on YouTube" is there for anyone whose browser blocks the embed and
 * for the page without JavaScript, where the play button cannot work.
 */
export function DemoVideo({ t, lang }: SectionProps & { lang: string }) {
  return (
    <section
      id="how-it-works-video"
      className={`${OFFSCREEN} scroll-mt-20 px-4 pt-8 pb-10 sm:pt-16`}
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading center title={t.videoTitle} sub={t.videoSub} />

        <div className="mt-8 sm:mt-10">
          <WalkthroughPlayer
            playLabel={t.videoPlay}
            frameTitle={t.videoFrameTitle}
            lang={lang}
          />
        </div>

        <p className="mt-3 flex justify-end">
          <a
            href={walkthroughWatchUrl()}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.videoWatchOnYouTube}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t.opensInNewTab}</span>
          </a>
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Free audit                                                                 */
/* -------------------------------------------------------------------------- */

/** Order matches auditItems in the dictionary. */
const AUDIT_ICONS: LucideIcon[] = [Search, BarChart3, Link2];

/**
 * The free check: three things it gives you, and the field.
 *
 * Also rendered on /audit itself, which supplies its own heading - so the
 * homepage's lead-in from the video ("Now see what RepGet finds on your
 * website") is opt-in through `intro`.
 */
export function AuditBand({
  t,
  href,
  intro = false,
}: SectionProps & { intro?: boolean }) {
  return (
    <section className={`${OFFSCREEN} px-4 pb-20 ${intro ? "pt-8" : ""}`}>
      <div className="mx-auto max-w-4xl">
        {intro ? (
          <SectionHeading
            center
            title={t.auditIntroTitle}
            sub={t.auditIntroSub}
            className="mb-8"
          />
        ) : null}

        {/*
          The glow the design puts behind this card. It is the page's primary
          conversion point, and the surrounding sections are plain, so a tinted
          ring is what separates it from the rest rather than making it louder.
        */}
        <div className="rounded-3xl bg-gradient-to-b from-primary/25 to-primary/5 p-[1.5px] shadow-[0_24px_70px_-30px_rgba(234,88,12,0.35)]">
          <div className="rounded-3xl bg-card p-6 sm:p-8">
            <p className="text-center text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {t.auditBand}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0">
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
                label={t.auditFieldLabel}
                placeholder={t.auditPlaceholder}
                cta={t.checkMyWebsite}
                pendingLabel={t.auditChecking}
                action={href("/audit")}
              />
            </div>
          </div>
        </div>

        {/* The reassurances from the design, under the card. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {t.auditAssurances.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded bg-success-soft">
                <Check className="size-3 text-success" aria-hidden="true" />
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

/**
 * The SEO score arc, used by the Audit step and the dashboard drawing.
 *
 * An SVG semicircle rather than a conic gradient: the reference has rounded
 * ends on the stroke, and strokeLinecap gives that for free. The dash offset
 * is computed from the score, so changing the number moves the arc.
 */
function ScoreArc({ score, tone = "text-success" }: { score: number; tone?: string }) {
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
          className={tone}
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

/**
 * Where articles can be published, each a real adapter in
 * lib/publishing/registry.ts with a setup guide at /docs/integrations/<slug>.
 * WordPress, Ghost, Shopify, Webflow and Wix connect directly through their
 * own APIs; the webhook is the generic route for anything else, and says so.
 * Search Console is not a publishing target - it appears in the Grow step,
 * where rankings come from.
 */
const INTEGRATIONS: {
  name: string;
  Mark: (props: { className?: string }) => React.ReactElement;
  /** Brand tint behind the mark. */
  tone: string;
  slug: string;
}[] = [
  { name: "WordPress", Mark: WordPressMark, tone: "bg-[#21759b]/10 text-[#21759b]", slug: "wordpress" },
  { name: "Ghost", Mark: GhostMark, tone: "bg-foreground/10 text-foreground", slug: "ghost" },
  { name: "Shopify", Mark: ShopifyMark, tone: "bg-[#95bf47]/15 text-[#5e8e3e]", slug: "shopify" },
  { name: "Webflow", Mark: WebflowMark, tone: "bg-[#4353ff]/10 text-[#4353ff]", slug: "webflow" },
  { name: "Wix", Mark: WixMark, tone: "bg-[#0c6efd]/10 text-[#0c6efd]", slug: "wix" },
  { name: "Webhook", Mark: WebhookMark, tone: "bg-primary/10 text-primary", slug: "webhook" },
];

/** The Audit step: a score and three findings the audit really reports. */
function AuditDrawing({ t }: { t: SectionProps["t"] }) {
  return (
    <div className="relative flex h-full flex-col">
      <ExampleChip label={t.exampleLabel} className="absolute top-0 right-0" />
      <p className="text-xs font-medium text-muted-foreground">{t.howAudit.score}</p>
      <div className="mt-1 w-24">
        <ScoreArc score={72} tone="text-[var(--chart-line)]" />
      </div>
      <ul className="mt-auto space-y-1">
        {t.howAudit.findings.map((finding) => (
          <li
            key={finding}
            className="flex items-start gap-2 rounded-lg bg-background px-2.5 py-1 text-xs leading-snug shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span className="min-w-0">{finding}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The Connect step: the platforms, each linking to its setup guide. Real
 * links rather than decoration, so this is the one drawing without an
 * "Example" label.
 */
function ConnectDrawing({ t, href }: SectionProps) {
  return (
    <ul className="grid h-full grid-cols-3 content-center gap-2">
      {INTEGRATIONS.map(({ name, Mark, tone, slug }) => (
        <li key={slug}>
          <Link
            href={href(`/docs/integrations/${slug}`)}
            aria-label={format(t.howConnectGuide, { name })}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-background px-1 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-primary/[0.04] focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
              <Mark className="size-4.5" />
            </span>
            <span className="text-[0.7rem] font-medium">{name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The Grow step: clicks rising, read from Search Console. Illustrative. */
function GrowDrawing({ t }: { t: SectionProps["t"] }) {
  return (
    <div className="relative flex h-full flex-col">
      <ExampleChip label={t.exampleLabel} className="absolute top-0 right-0" />
      <p className="text-xs font-medium text-muted-foreground">{t.howGrow.metric}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
        <SearchConsoleMark className="size-3.5 text-[#458cf5]" />
        {t.howGrow.source}
      </p>
      <svg
        viewBox="0 0 240 90"
        className="mt-auto h-24 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="grow-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-line)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 82 L30 78 L60 74 L90 70 L120 58 L150 52 L180 36 L210 28 L240 12 L240 90 L0 90 Z"
          fill="url(#grow-fill)"
        />
        <path
          d="M0 82 L30 78 L60 74 L90 70 L120 58 L150 52 L180 36 L210 28 L240 12"
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function HowItWorks({ t, href }: SectionProps) {
  const drawings = [
    <AuditDrawing key="audit" t={t} />,
    <ConnectDrawing key="connect" t={t} href={href} />,
    <GrowDrawing key="grow" t={t} />,
  ];

  return (
    <section
      id="how-it-works"
      className={`${OFFSCREEN} scroll-mt-20 border-t px-4 py-20 ${TINT}`}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading center title={t.howItWorks} sub={t.howItWorksSub} />

        <ol className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className={`${CARD} flex flex-col p-4 md:max-lg:flex-row md:max-lg:items-center md:max-lg:gap-6`}
            >
              <div className="h-60 rounded-xl border bg-muted/40 p-3.5 md:max-lg:w-1/2 md:max-lg:shrink-0">
                {drawings[index] ?? null}
              </div>
              <div className="flex flex-1 flex-col px-1 pt-5 pb-1 md:max-lg:pt-1">
                <h3 className="flex items-center gap-3 text-lg font-semibold">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
                    {index + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                {index === 1 ? (
                  <p className="mt-3 text-xs text-muted-foreground">{t.howConnectNote}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Problems and solutions, and the one-subscription panel                     */
/* -------------------------------------------------------------------------- */

/**
 * Each problem beside its answer: a neutral card, an arrow, a warm card. In
 * pairs rather than two columns, so on a phone every problem is followed by
 * its own answer instead of all three problems first and the answers a
 * screen later. Every answer names something the product does today.
 *
 * The design puts a customer photo beside each problem. Those are real people
 * from a real product, so these carry no avatars rather than stock faces
 * pretending to be customers.
 *
 * #traffic-recovery is the Platform menu's "Traffic Recovery": the last pair
 * is the losing-traffic report, which is exactly that.
 */
export function ProblemSolution({ t, href }: SectionProps) {
  return (
    <section
      id="traffic-recovery"
      className={`${OFFSCREEN_TALL} scroll-mt-20 border-t px-4 pt-20 pb-12`}
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading center eyebrow={t.problemsEyebrow} title={t.problemsTitle} />

        {/* Column labels from md, where the pairs sit side by side. */}
        <div
          aria-hidden="true"
          className="mt-12 hidden grid-cols-[1fr_2.5rem_1fr] gap-4 px-1 text-xs font-semibold tracking-[0.12em] uppercase md:grid"
        >
          <span className="text-muted-foreground">{t.yourProblem}</span>
          <span />
          <span className="text-primary">{t.ourSolution}</span>
        </div>

        <ul className="mt-6 space-y-6 md:mt-3 md:space-y-4">
          {t.pairs.map((pair) => (
            <li
              key={pair.problem}
              className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_2.5rem_1fr] md:gap-4"
            >
              <div className="flex gap-3 rounded-2xl border bg-card p-5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                  <X className="size-3 text-muted-foreground" aria-hidden="true" />
                </span>
                <p className="text-sm text-muted-foreground">
                  <span className="mb-1 block text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase md:sr-only">
                    {t.yourProblem}
                  </span>
                  {pair.problem}
                </p>
              </div>
              <div aria-hidden="true" className="flex items-center justify-center text-primary/60">
                <ArrowDown className="size-4 md:hidden" />
                <ArrowRight className="hidden size-5 md:block" />
              </div>
              <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.045] p-5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Check className="size-3 text-primary-strong" aria-hidden="true" />
                </span>
                <p className="text-sm text-foreground">
                  <span className="mb-1 block text-xs font-semibold tracking-[0.12em] text-primary-strong uppercase md:sr-only">
                    {t.ourSolution}
                  </span>
                  {pair.solution}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/*
          One subscription, as the close of the same argument rather than a
          section of its own. The design prices nine named competitors here;
          their prices change without telling us and getting one wrong in our
          favour is the kind of claim that ends in a complaint, so this lists
          what we do instead.
        */}
        <div className="mt-14 grid grid-cols-1 gap-8 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent p-6 sm:p-10 md:grid-cols-[1fr_1.15fr] md:gap-10">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {t.stackTitle} <span className="text-primary">{t.stackTitleAccent}</span>
            </h3>
            <p className="mt-3 text-muted-foreground">{t.stackSub}</p>
            <Button asChild className="mt-6">
              <Link href={href("/pricing")}>
                {t.seePricing}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <ul className="grid grid-cols-1 content-center gap-x-6 gap-y-3 sm:grid-cols-2">
            {t.replaces.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15"
                  aria-hidden="true"
                >
                  <Check className="size-3 text-primary-strong" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Four pillars                                                               */
/* -------------------------------------------------------------------------- */

/** Order matches `pillars` in the dictionary. */
const PILLAR_ICONS: LucideIcon[] = [FileText, Link2, BarChart3, Sparkles];

/** The four benefits, compact: one row on a desktop, two by two below it. */
export function Pillars({ t }: SectionProps) {
  return (
    <section className={`${OFFSCREEN} px-4 pb-20`}>
      <ul className="mx-auto grid grid-cols-1 max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.pillars.map((pillar, index) => {
          const Icon = PILLAR_ICONS[index] ?? FileText;
          return (
            <li key={pillar.title} className={`${CARD} p-5`}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <p className="mt-4 font-semibold">{pillar.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{pillar.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Article examples                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What an article looks like, with the publishing notes that used to be a
 * section of their own. #content-engine is the Platform menu's "Content
 * Engine".
 *
 * The samples are written for this page and labelled so: they show the
 * format the generator produces (sections, contents list, a comparison table
 * when it helps), not an article from a customer account. Swap in approved
 * real examples by editing `articles.samples` in the dictionary.
 */
export function ContentEngine({ t, href }: SectionProps) {
  return (
    <section
      id="content-engine"
      className={`${OFFSCREEN_TALL} scroll-mt-20 border-t px-4 py-20 ${TINT}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-12">
          <SectionHeading eyebrow={t.articles.eyebrow} title={t.articles.title} sub={t.articles.sub} />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {t.articles.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15"
                  aria-hidden="true"
                >
                  <Check className="size-3 text-primary-strong" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <ArticleExamples t={t.articles} />
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t.publishesSub} {t.publishesPlugin}
          </p>
          <Button size="lg" asChild className={CTA}>
            <Link href={href("/audit")}>
              {t.checkFree}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* What you see                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the dashboard shows, drawn as the analytics cards from the design.
 *
 * The design shows four named businesses with figures like "855% increase in
 * impressions". Those are real customers of a real product; inventing
 * equivalents would be fabricating results. These cards show WHAT is
 * measured - Search Console, AI visibility, backlinks, published content -
 * with example data, labelled as such on every card and under the grid.
 */
const AI_ROWS: { name: string; mentioned: boolean }[] = [
  { name: "ChatGPT", mentioned: true },
  { name: "Perplexity", mentioned: true },
  { name: "Gemini", mentioned: false },
  { name: "Claude", mentioned: true },
];

function CardTitle({
  icon: Icon,
  label,
  detail,
  example,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  example: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-4.5 text-primary" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <ExampleChip label={example} />
    </div>
  );
}

export function WhatYouSee({ t }: SectionProps) {
  const [search, ai, backlinks, content] = t.tracked;
  const demo = t.trackedDemo;

  return (
    /*
      #tracking: both "Search Performance" and "AI Presence" point here.
      This section covers rankings from Search Console AND whether assistants
      name you, so one target is honest rather than a compromise.
    */
    <section id="tracking" className={`${OFFSCREEN_TALL} scroll-mt-20 border-t px-4 py-20`}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading center title={t.trackedTitle} sub={t.trackedSub} />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {search ? (
            <div className={`${CARD} p-5 lg:col-span-7`}>
              <CardTitle icon={BarChart3} label={search.label} detail={search.detail} example={t.exampleLabel} />
              <div className="mt-4 flex gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-[var(--chart-line)]" aria-hidden="true" />
                  {demo.clicks}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-info/60" aria-hidden="true" />
                  {demo.impressions}
                </span>
              </div>
              <svg viewBox="0 0 400 140" className="mt-3 h-40 w-full" preserveAspectRatio="none" aria-hidden="true">
                <g stroke="currentColor" className="text-border" strokeWidth="1">
                  <line x1="0" x2="400" y1="35" y2="35" />
                  <line x1="0" x2="400" y1="70" y2="70" />
                  <line x1="0" x2="400" y1="105" y2="105" />
                </g>
                <path
                  d="M0 96 L40 92 L80 94 L120 84 L160 80 L200 70 L240 66 L280 52 L320 46 L360 34 L400 26"
                  fill="none"
                  stroke="var(--info)"
                  strokeOpacity="0.6"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 124 L40 122 L80 118 L120 116 L160 108 L200 104 L240 96 L280 90 L320 80 L360 72 L400 60"
                  fill="none"
                  stroke="var(--chart-line)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          ) : null}

          {ai ? (
            <div className={`${CARD} p-5 lg:col-span-5`}>
              <CardTitle icon={Bot} label={ai.label} detail={ai.detail} example={t.exampleLabel} />
              <ul className="mt-4 divide-y rounded-xl border">
                {AI_ROWS.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="font-medium">{row.name}</span>
                    {row.mentioned ? (
                      <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                        <CircleCheck className="size-3" aria-hidden="true" />
                        {demo.mentioned}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {demo.notYet}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {backlinks ? (
            <div className={`${CARD} p-5 lg:col-span-5`}>
              <CardTitle icon={Link2} label={backlinks.label} detail={backlinks.detail} example={t.exampleLabel} />
              <div className="mt-5 flex items-end justify-between gap-4">
                <p>
                  <span className="block text-3xl font-semibold tabular-nums">14</span>
                  <span className="text-xs text-muted-foreground">{demo.liveLinks}</span>
                </p>
                <div className="flex h-20 items-end gap-1.5" aria-hidden="true">
                  {[3, 5, 4, 7, 8, 11, 14].map((value, index) => (
                    <span
                      key={index}
                      className="w-4 rounded-t bg-primary/25 last:bg-primary/70"
                      style={{ height: `${(value / 14) * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {content ? (
            <div className={`${CARD} p-5 lg:col-span-7`}>
              <CardTitle icon={FileText} label={content.label} detail={content.detail} example={t.exampleLabel} />
              <ul className="mt-4 divide-y rounded-xl border">
                {t.preview.calendar.slice(0, 3).map((row, index) => (
                  <li key={row.title} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="min-w-0">{row.title}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        index < 2 ? "bg-success-soft text-success" : "bg-info-soft text-info"
                      }`}
                    >
                      {index < 2 ? demo.published : demo.scheduled}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">{t.trackedCaption}</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Backlink network                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The exchange, with a drawing of one placement beside it: a related business,
 * an article on its site, and the mention in its body. No domain names and no
 * authority scores - those would be invented - and labelled as an example.
 */
export function BacklinkNetwork({ t, href }: SectionProps) {
  const card = t.networkCard;
  return (
    // #authority-network: the Platform menu's "Authority Network".
    <section
      id="authority-network"
      className={`${OFFSCREEN} scroll-mt-20 border-t px-4 py-20 ${TINT}`}
    >
      <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            eyebrow={t.networkEyebrow}
            title={t.networkTitle}
            sub={t.networkTitleRest}
          />
          <p className="mt-8 font-medium">{t.networkHeading}</p>
          <ul className="mt-4 space-y-2.5">
            {t.networkPoints.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15"
                  aria-hidden="true"
                >
                  <Check className="size-3 text-primary-strong" />
                </span>
                <span className="text-sm text-muted-foreground">{point}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" asChild className="mt-7">
            <Link href={href("/backlink-exchange")}>
              {t.networkHowLink}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className={`${CARD} relative p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="size-4 text-primary" aria-hidden="true" />
              </span>
              {card.label}
            </p>
            <ExampleChip label={t.exampleLabel} />
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="size-3.5" aria-hidden="true" />
            {card.site}
          </p>

          {/* The partner's article, with your mention inside it. */}
          <div className="mt-2 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold leading-snug">{card.article}</p>
            <div className="mt-3 space-y-2" aria-hidden="true">
              <span className="block h-2 w-full rounded bg-border" />
              <span className="block h-2 w-11/12 rounded bg-border" />
            </div>
            <p className="mt-2.5 text-sm">
              <span className="rounded bg-primary/10 px-1 text-primary-strong underline decoration-primary/50 underline-offset-2">
                {card.mention}
              </span>
            </p>
            <div className="mt-2.5 space-y-2" aria-hidden="true">
              <span className="block h-2 w-10/12 rounded bg-border" />
              <span className="block h-2 w-7/12 rounded bg-border" />
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2 text-xs">
            {[card.placement, card.status].map((item) => (
              <li key={item} className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {item}
              </li>
            ))}
            <li className="rounded-full border px-2.5 py-1 font-medium text-muted-foreground">
              {card.credit}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Product preview                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard, drawn in markup rather than shipped as a screenshot, so it
 * stays sharp, translates with the page, and does not go stale the next time
 * the real dashboard changes shape.
 *
 * The figures are ILLUSTRATIVE and the caption says so: a reader who takes 12
 * published articles as a promise has been misled. Generic subject matter
 * rather than the design's travel business, which reads as a real customer's
 * calendar.
 *
 * On a phone only the figures and the calendar show, at readable sizes; the
 * latest-article and score panels, too dense to read at that width, appear
 * from sm.
 */
const PREVIEW_STATS = [
  { value: "12", delta: "+71%", icon: FileText },
  { value: "28", delta: "+56%", icon: Link2 },
  { value: "18", delta: "+83%", icon: Search },
  { value: "4.2K", delta: "+120%", icon: BarChart3 },
];

const PREVIEW_NAV_ICONS: LucideIcon[] = [
  LayoutDashboard,
  FileText,
  Link2,
  Search,
  CalendarDays,
  BarChart3,
  Settings,
];

export function ProductPreview({ t }: SectionProps) {
  const p = t.preview;
  /**
   * Status colours match the real product: draft is neutral, generating is
   * the brand orange because something is happening, planned is blue.
   */
  const statuses = [
    { label: p.statusDraft, tone: "bg-muted text-muted-foreground" },
    { label: p.statusGenerating, tone: "bg-primary/10 text-primary-strong" },
    { label: p.statusPlanned, tone: "bg-info-soft text-info" },
    { label: p.statusPlanned, tone: "bg-info-soft text-info" },
  ];

  return (
    <section className={`${OFFSCREEN_TALL} border-t px-4 py-20`}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading center title={t.previewTitle} sub={t.previewSub} />

        {/*
          The grey device frame from the design — a padded outer shell with the
          app inset inside it, which is what makes the mock read as a screen
          rather than as more page. Hidden from screen readers as a whole: it
          is a picture of a dashboard, and the caption says what it is.
        */}
        <div
          aria-hidden="true"
          className="mt-12 rounded-[1.75rem] border bg-muted/50 p-2 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.35)] sm:p-3"
        >
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <BrandMark size={18} />
                <span className="text-sm font-semibold">RepGet</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Plus className="size-4" />
                <UserRound className="size-4" />
              </div>
            </div>

            <div className="flex">
              {/* Sidebar. Hidden on a phone, where it would eat half the frame. */}
              <div className="hidden w-44 shrink-0 border-r p-3 lg:block">
                <ul className="space-y-0.5">
                  {p.nav.map((label, index) => {
                    const Icon = PREVIEW_NAV_ICONS[index] ?? FileText;
                    return (
                      <li
                        key={label}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
                          index === 0
                            ? "bg-primary/10 font-medium text-primary-strong"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold">{p.nav[0]}</p>
                  <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                    {p.period}
                    <ChevronDown className="size-3" />
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {PREVIEW_STATS.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div key={index} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="size-3.5 text-primary" />
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.stats[index]}</p>
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
                          <TrendingUp className="size-3" />
                          {stat.delta}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{p.calendarTitle}</p>
                      <span className="flex items-center gap-1 text-xs text-primary-strong">
                        {p.viewAll}
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                    <ul className="mt-2 divide-y">
                      {p.calendar.map((row, index) => (
                        <li key={row.title} className="flex items-center gap-3 py-2">
                          <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1">
                            <span className="text-[0.6rem] tracking-wide text-muted-foreground uppercase">
                              {row.month}
                            </span>
                            <span className="text-sm leading-none font-semibold">{row.day}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs">{row.title}</span>
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${statuses[index]?.tone ?? ""}`}
                            >
                              {statuses[index]?.label}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{p.latestTitle}</p>
                        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-medium text-success">
                          {p.statusPublished}
                        </span>
                      </div>
                      {/*
                        A tinted block rather than a stock photograph: shipping
                        a real photo here would be a picture of a place no
                        customer of ours has written about.
                      */}
                      <div className="mt-2 aspect-[16/9] rounded-lg bg-gradient-to-br from-primary/25 via-primary/10 to-info/20" />
                      <p className="mt-2 text-xs leading-snug font-medium">{p.articleTitle}</p>
                      <p className="mt-1 line-clamp-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                        {p.articleExcerpt}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.7rem]">
                        {p.viewArticle}
                        <ArrowRight className="size-2.5" />
                      </span>
                    </div>

                    <div className="rounded-xl border p-3">
                      <p className="text-xs font-semibold">{p.scoreTitle}</p>
                      <div className="mt-1">
                        <ScoreArc score={97} />
                      </div>
                      <ul className="mt-2 space-y-1">
                        {p.checks.map((check) => (
                          <li key={check} className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                            <CircleCheck className="size-3 shrink-0 text-success" />
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

        <p className="mt-4 text-center text-xs text-muted-foreground">{t.previewCaption}</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A warm, lightly tinted panel rather than a solid orange block: the free
 * check button is the only solid orange in it, so it is unmistakably the
 * thing to press. The reassurances are the published terms (14-day refund,
 * cancel any time - see /refunds).
 */
export function ClosingCta({ t, href }: SectionProps) {
  return (
    <section className={`${OFFSCREEN} px-4 pt-4 pb-20`}>
      <div className="mx-auto max-w-6xl rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/[0.08] via-primary/[0.04] to-primary/[0.02] px-6 py-14 text-center sm:px-10 sm:py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.closingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">{t.closingSub}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild className={CTA}>
            <Link href={href("/audit")}>
              {t.checkFree}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {[t.cancelAnytime, t.guarantee].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="size-4 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
