"use client";

import { Building2, Clock, TrendingUp } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";

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
const STATS: {
  icon: typeof Building2;
  /** A literal number, or a dictionary key when the value is a word. */
  value: string | keyof Messages["app"]["common"];
  label: keyof Messages["app"]["common"];
}[] = [
  { icon: Building2, value: "8", label: "aiAssistantsTracked" },
  { icon: TrendingUp, value: "weekly", label: "freshArticles" },
  { icon: Clock, value: "twoMinutes", label: "toSetUp" },
];

export function OnboardingAside({
  /** Headline over the card, naming what this step leads to. */
  title,
  /** A sentence under it. */
  note,
  children,
  t = getMessages("en").app.common,
}: {
  title: string;
  note: string;
  /** Shared words, defaulting to English. */
  t?: Messages["app"]["common"];
  /** Optional extra below the card — a preview of what the step produces. */
  children?: React.ReactNode;
}) {
  return (
    /*
      Hidden below lg. On a phone this panel would push the form — the only
      reason anyone is on the page — below the fold.

      No longer sticky. Sticky suits a panel beside a form far taller than
      itself; here the two are close in height, so it never had anything to
      scroll against and the `h-fit` it required was what capped the panel
      short of the form.
    */
    <aside className="hidden lg:block">
      {/*
        Fills the grid track rather than its own content.

        This was `h-fit` with `lg:sticky`, which is the right pairing for a
        panel that scrolls alongside a much longer form — but on this screen
        the form is barely taller than the panel, so sticky bought nothing and
        h-fit capped the panel at its content, leaving the empty space beside
        the plan's feature list. `h-full` lets the stretched track set the
        height; min-h keeps it substantial if a step's content is very short.
      */}
      <div className="relative flex h-full min-h-[34rem] flex-col overflow-hidden rounded-3xl border bg-muted/30 p-8">
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
        <WorldMap className="pointer-events-none absolute inset-x-0 top-[22%] mx-auto w-[118%] max-w-none -translate-x-[8%] text-muted-foreground/25 select-none" />

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
                {/*
                  A plain number stays as it is; a word is looked up. "8" is
                  the same in every language, "Weekly" is not.
                */}
                {stat.value in t
                  ? t[stat.value as keyof Messages["app"]["common"]]
                  : stat.value}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {t[stat.label]}
              </span>
            </div>
          ))}
        </div>

        {/*
          "Trusted by businesses worldwide", over the map rather than under
          it.

          The client: "We wanted to place the: Trusted by businesses
          worldwide somewhere here, instead of living it close to the
          footer." It was pinned to the bottom of the panel with mt-auto,
          which on a tall panel pushed it far below the map it was meant to
          caption - close enough to the page footer to read as one.

          Sitting above the card it captions the map directly, which is the
          job the line was doing all along.
        */}
        <p className="relative pt-8 text-center text-[10px] font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
          {t.trustedByBusinesses}
        </p>

        {/*
          The card FLOATS ON the map in the reference — the overlap is what
          makes the panel one composition rather than a stat strip, a pattern
          and a note stacked in a box.

          `my-auto` centres it in whatever space is left between the stat strip
          above and the footing line below, so it stays over the map's middle
          at any panel height instead of being pinned a fixed distance from
          the stats.
        */}
        <div className="relative my-auto rounded-2xl border bg-background/95 p-6 text-foreground shadow-lg backdrop-blur">
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

      </div>
    </aside>
  );
}
