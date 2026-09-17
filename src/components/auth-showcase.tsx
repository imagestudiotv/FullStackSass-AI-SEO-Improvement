"use client";

import { ChevronDown, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The right-hand panel on the sign-in and sign-up screens.
 *
 * The reference designs fill this with rotating five-star customer
 * testimonials — named people, job titles, photographs, and figures like "our
 * organic traffic increased by 328%".
 *
 * We have no customers yet, so inventing them with headshots would be
 * fabricating testimonials on the exact screen where someone decides whether
 * to trust us with their website. This keeps the reference's SHAPE — an
 * eyebrow, a two-line headline, a lead card and a stacked pair beside it, star
 * rows, quote marks, dots underneath — and fills it with what the product
 * actually does.
 *
 * WHEN REAL CUSTOMERS AGREE TO BE QUOTED: this component is where they go.
 * Give each GROUP a `quote`, `name` and `role`, render those instead of
 * `headline`/`body`, and the layout is already right — the star row and quote
 * mark are drawn for a testimonial, not for a feature.
 */

type Panel = {
  headline: string;
  body: string;
};

/**
 * Three groups, rotated. Each is one lead panel and two supporting ones, which
 * is the reference's arrangement — a large card on the left and a stacked pair
 * on the right — rather than a single quote that leaves the panel half empty.
 */
const GROUPS: { lead: Panel; supporting: [Panel, Panel] }[] = [
  {
    lead: {
      headline: "Articles written and published for you",
      body: "Researched against what your customers actually search for, written for your site, and posted to it — WordPress, Ghost, Shopify or a webhook. You approve them first unless you say otherwise.",
    },
    supporting: [
      {
        headline: "One article a month, or a hundred",
        body: "Your plan decides the pace. The calendar spreads them across the month rather than dumping them in a day.",
      },
      {
        headline: "Nothing publishes behind your back",
        body: "Auto-publish is off until you turn it on.",
      },
    ],
  },
  {
    lead: {
      headline: "Backlinks earned, not bought",
      body: "Host one article for a business in a related field and earn a credit you can spend on a link back to your own site. Every link sits inside a real article, checked daily.",
    },
    supporting: [
      {
        headline: "Related topics only",
        body: "A dentist is never matched with a crypto blog. An irrelevant link is worth nothing and can do harm.",
      },
      {
        headline: "Refunded if a link disappears",
        body: "We re-check every day. If one is removed, the credit comes back.",
      },
    ],
  },
  {
    lead: {
      headline: "See whether AI assistants name you",
      body: "We ask the questions your customers ask ChatGPT, Claude and Perplexity, and track whether your business comes up in the answer — the search everyone is still pretending does not matter.",
    },
    supporting: [
      {
        headline: "Rankings from your own Search Console",
        body: "Measured, not estimated. You see which queries moved and what it was worth in clicks.",
      },
      {
        headline: "Find out free, first",
        body: "The check reads your pages and shows what is holding you back before you pay anything.",
      },
    ],
  },
];

/** Long enough to read a short paragraph without feeling stuck. */
const ROTATE_MS = 7000;

function Stars() {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-4 fill-primary text-primary" />
      ))}
    </div>
  );
}

export function AuthShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % GROUPS.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const group = GROUPS[index];

  return (
    <div
      /*
        Scrolls rather than clipping. It was overflow-hidden and centred, so
        anything past the viewport was simply cut off — and a "more below" cue
        on a panel that cannot move would be a lie. sticky top-0 with its own
        height keeps it beside the form while letting its contents run past the
        fold on a short screen.
      */
      className="relative top-0 hidden max-h-svh flex-col justify-center overflow-y-auto bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.04] p-10 lg:sticky lg:flex xl:p-14"
      /*
        The faint grid from the reference. An inline gradient rather than an
        image: it is two lines, costs no request, and stays crisp at any size.
      */
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      <div className="w-full max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          What RepGet does for your website
        </p>

        {/*
          The handwritten aside from the design, which is what stops this panel
          reading as another slab of marketing copy. The reference writes "Same
          marketers. Bigger results." — a claim about customers we do not have,
          so this one is about the work instead.
        */}
        <p
          className="pointer-events-none absolute top-10 right-10 hidden max-w-[11rem] -rotate-6 text-right text-sm leading-snug text-muted-foreground xl:block"
          style={{ fontFamily: "ui-rounded, 'Segoe UI', cursive" }}
          aria-hidden="true"
        >
          Same website.
          <br />
          More of it found.
        </p>

        {/*
          The reference's two-line headline, in the product's own voice. It
          says what the tool is for rather than claiming a crowd we do not
          have — "join 2,000+ marketers" is the one line on that design we
          cannot honestly copy.
        */}
        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
          Content that ranks.
          <br />
          <span className="text-primary">Links that count.</span>
        </h2>

        {/*
          The paragraph the design puts under the headline. The reference says
          "Join 2,000+ marketers, agencies and businesses" — the one line on
          that design that is a number we do not have, so this says what the
          product does for the person reading instead.
        */}
        <p className="mt-4 max-w-md text-muted-foreground">
          Everything a small business needs to get found — articles, backlinks
          and the rankings that follow — in one place, running on its own.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-5">
          {/* Lead panel, wider — the reference's large left card. */}
          <div className="relative rounded-2xl border bg-background/80 p-6 shadow-sm backdrop-blur xl:col-span-3">
            <Stars />
            <p className="mt-4 text-lg leading-snug font-semibold text-balance">
              {group.lead.headline}
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {group.lead.body}
            </p>
            <Quote
              className="absolute right-5 bottom-5 size-8 text-primary/15"
              aria-hidden="true"
            />
          </div>

          {/* The stacked pair beside it. */}
          <div className="grid gap-4 xl:col-span-2">
            {group.supporting.map((panel) => (
              <div
                key={panel.headline}
                className="rounded-2xl border bg-background/80 p-5 shadow-sm backdrop-blur"
              >
                <Stars />
                <p className="mt-3 text-sm leading-snug font-semibold text-balance">
                  {panel.headline}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {panel.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/*
          The separator the client asked for, from babylovegrowth's sign-in: a
          rule and a nudge, so it is clear the panel continues below the fold
          rather than ending where the viewport happens to cut it.

          Rendered in flow rather than fixed to the viewport, so it sits under
          the cards at whatever height they end up and does not float over them
          on a short screen.
        */}
        <div className="mt-10 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
            Keep scrolling
            <ChevronDown
              className="size-3.5 animate-bounce"
              aria-hidden="true"
            />
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>

        {/*
          A visual under the cards, since the panel has room below the fold.

          Built from the product rather than being a photograph: the client
          offered to let me choose an image, and a stock photo of a business
          would be a picture of a company that does not use RepGet, sitting on
          the screen where someone decides whether to trust it. This is the
          same score dial the dashboard shows, which is a real thing they will
          see once they are in.
        */}
        <div className="mt-8 flex items-center gap-5 rounded-2xl border bg-background/70 p-5 backdrop-blur">
          <div className="relative shrink-0">
            <svg viewBox="0 0 96 96" className="size-20" aria-hidden="true">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="currentColor"
                className="text-muted"
                strokeWidth="10"
              />
              {/*
                283 is the circumference at r=40. The offset leaves roughly a
                quarter of the ring unfilled, which reads as a score rather
                than as a loading spinner frozen mid-turn.
              */}
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="currentColor"
                className="text-primary"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset="64"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums">
              77
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Your site, scored in a minute</p>
            <p className="mt-1 text-sm text-muted-foreground">
              What is holding it back, what to fix first, and whether AI
              assistants mention you — before you pay anything.
            </p>
          </div>
        </div>

        {/* Dots. Clickable, so someone who wants to re-read one can go back. */}
        <div className="mt-8 flex gap-1.5">
          {GROUPS.map((g, i) => (
            <button
              key={g.lead.headline}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show panel ${i + 1}`}
              aria-current={i === index}
              className={`size-2 rounded-full transition-colors ${
                i === index ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
