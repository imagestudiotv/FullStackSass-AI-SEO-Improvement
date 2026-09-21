"use client";

import { Building2, Clock, TrendingUp } from "lucide-react";

import { WorldMap } from "@/components/onboarding/world-map";

/**
 * The panel down the right of every onboarding step.
 *
 * The reference fills it with a stat strip, a dotted world map and a rotating
 * carousel of named customers with photographs and figures ("organic traffic
 * increased from 120 visits per month to over 12,000").
 *
 * WE HAVE NO CUSTOMERS YET, so the testimonial half of that is not available
 * to us. Inventing one — a name, a face, a growth figure — on the screen where
 * someone is about to enter their card details would be fabricating evidence
 * to take money. The same decision was already made for the sign-in panel; see
 * components/auth-showcase.tsx, which this deliberately matches so the two
 * screens feel like one product.
 *
 * What is kept is the SHAPE: the stat strip, the dotted field, and a card in
 * the carousel's position — filled with what the step ahead actually does, so
 * the panel still answers "what am I getting" rather than sitting empty.
 *
 * WHEN REAL CUSTOMERS AGREE TO BE QUOTED: replace `note` with the quote, add
 * name/role/photograph, and the layout needs no other change — the card is
 * already the reference's testimonial card.
 */

/**
 * The three figures across the top.
 *
 * Deliberately NOT the reference's "4,000+ companies / 40% avg. growth / 90
 * days to traction", which are its numbers and would be a lie on our screen.
 * These describe the product's own mechanics, which are true on day one:
 * nothing here is a claim about results we have not produced.
 */
const STATS: { icon: typeof Building2; value: string; label: string }[] = [
  { icon: Building2, value: "8", label: "AI assistants tracked" },
  { icon: TrendingUp, value: "Weekly", label: "Fresh articles" },
  { icon: Clock, value: "2 min", label: "To set up" },
];

export function OnboardingAside({
  /** Headline over the card, naming what this step leads to. */
  title,
  /** A sentence under it. */
  note,
  children,
}: {
  title: string;
  note: string;
  /** Optional extra below the card — a preview of what the step produces. */
  children?: React.ReactNode;
}) {
  return (
    /*
      Sticky rather than scrolling with the form. The form side is the one
      with the work on it; this side is reference, and a reference panel that
      scrolls away is one the customer has to scroll back to.

      `h-fit` keeps sticky working — a flex child stretches to full height by
      default, which leaves nothing for `top` to bite on.
    */
    <aside className="hidden h-fit lg:sticky lg:top-8 lg:block">
      <div className="relative flex min-h-[30rem] flex-col overflow-hidden rounded-3xl border bg-muted/30 p-8">
        {/*
          The dotted world map the reference puts behind this panel.

          Absolutely positioned and behind everything: it is decoration, and
          the stat strip and card must sit on it rather than beside it. The
          uniform dot grid this replaces filled the same space but read as
          texture — the reference's shape is recognisably continents, which is
          what makes the panel feel like a map of somewhere rather than a
          pattern.

          No markers on it. Those are customer locations in the reference and
          we would be inventing every one.
        */}
        <WorldMap className="pointer-events-none absolute inset-x-0 top-24 mx-auto w-[115%] max-w-none -translate-x-[6%] text-muted-foreground/25 select-none" />

        {/* Stat strip, divided, as drawn. Above the map. */}
        <div className="relative flex items-start justify-center gap-6 text-center text-foreground sm:gap-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1.5 border-l pl-6 first:border-l-0 first:pl-0 sm:pl-8"
            >
              <span className="flex size-9 items-center justify-center rounded-full border bg-background">
                <stat.icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <span className="text-xl font-semibold tracking-tight">
                {stat.value}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/*
          The card sitting over the map in the reference. Ours carries the
          step's own promise rather than a quote.
        */}
        <div className="relative mt-10 rounded-2xl border bg-background/90 p-6 text-foreground shadow-sm backdrop-blur">
          <p className="text-lg leading-snug font-semibold text-balance">
            {title}
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {note}
          </p>
        </div>

        {children ? (
          <div className="relative mt-4 text-foreground">{children}</div>
        ) : null}

        {/*
          The footing line the reference sets under its map.

          Deliberately "worldwide" and nothing more. The reference pairs this
          with customer logos and a review score; both are that company's, and
          the line on its own is a statement about where the product can be
          used rather than a count of who uses it — which is true on day one
          and stays true.

          `mt-auto` rather than a fixed margin: with the panel stretched to
          the form's height this pins the line to the bottom, which is where
          the reference has it. Without stretching it simply follows the
          content.
        */}
        <p className="relative mt-auto pt-12 text-center text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
          Trusted by businesses worldwide
        </p>
      </div>
    </aside>
  );
}
