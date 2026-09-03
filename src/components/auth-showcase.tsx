"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The right-hand panel on the sign-in and sign-up screens.
 *
 * The reference design fills this with rotating five-star customer
 * testimonials — named people, job titles, photographs, and figures like "our
 * AI visibility score went from 4% to 41%".
 *
 * We have no customers yet, so inventing four of them with headshots would be
 * fabricating testimonials on the screen where a customer decides whether to
 * trust us with their website. This keeps the design's shape — a rotating
 * panel beside the form, on the same grid background — and rotates through
 * what the product actually does instead.
 *
 * The moment there are real customers who agree to be quoted, this component
 * is where they go: swap SLIDES for their words, add a photo and a name, and
 * the layout is already right.
 */

type Slide = {
  headline: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    headline: "Find out where you stand, free",
    body: "We read your pages and show you what is holding you back on Google — before you pay for anything.",
  },
  {
    headline: "Get named by AI assistants",
    body: "We ask the questions your customers ask an assistant, and track whether your business comes up in the answer.",
  },
  {
    headline: "Articles written and published for you",
    body: "Researched, written, and posted to your own site — WordPress, Ghost, Shopify or a webhook.",
  },
  {
    headline: "Backlinks earned, not bought",
    body: "Host one article for a related business, earn a link back. Checked daily, and refunded if one disappears.",
  },
];

/** Long enough to read a short paragraph without feeling stuck. */
const ROTATE_MS = 6000;

export function AuthShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[index];

  return (
    <div
      className="relative hidden items-center justify-center overflow-hidden bg-muted/20 p-10 lg:flex"
      /*
        The faint grid from the reference. An inline gradient rather than an
        image: it is two lines, costs no request, and stays crisp at any size.
      */
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.045) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-background/80 p-8 shadow-sm backdrop-blur">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-5 fill-primary text-primary" />
            ))}
          </div>

          <p className="mt-6 text-xl leading-relaxed font-medium text-balance">
            {slide.headline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {slide.body}
          </p>
        </div>

        {/* Dots. Clickable, so someone who wants to re-read one can go back. */}
        <div className="mt-6 flex justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.headline}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-7 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
