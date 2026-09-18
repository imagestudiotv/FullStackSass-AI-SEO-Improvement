"use client";

import { Building2, Clock, TrendingUp } from "lucide-react";

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
      <div
        className="relative overflow-hidden rounded-3xl border bg-muted/30 p-8 text-muted-foreground/30"
        /*
          The dotted field behind the reference's world map, as a radial
          gradient rather than an image: it is one line of CSS, costs no
          request, and stays sharp at any size. A literal map would also be
          a claim — the reference's dots are its customers' locations.
        */
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        {/* Stat strip, divided, as drawn. */}
        <div className="flex items-start justify-center gap-6 text-center text-foreground sm:gap-8">
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
        <div className="mt-10 rounded-2xl border bg-background/90 p-6 text-foreground shadow-sm backdrop-blur">
          <p className="text-lg leading-snug font-semibold text-balance">
            {title}
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {note}
          </p>
        </div>

        {children ? (
          <div className="mt-4 text-foreground">{children}</div>
        ) : null}
      </div>
    </aside>
  );
}
