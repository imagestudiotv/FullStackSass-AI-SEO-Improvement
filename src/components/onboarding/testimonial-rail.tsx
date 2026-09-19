"use client";

/* eslint-disable @next/next/no-img-element --
   Customer photographs are supplied as ordinary files under /public and are
   rendered at a fixed 40px. next/image would add a layout wrapper and an
   optimiser round-trip for an avatar that is already the right size. */

import { Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

import {
  REVIEW_SCORE,
  TESTIMONIALS,
  type Testimonial,
} from "@/lib/marketing/testimonials";

/**
 * The rotating customer quote and review badge from the reference design.
 *
 * RENDERS NOTHING WHEN THERE IS NOTHING TRUE TO SHOW. The data file is empty
 * on purpose — see lib/marketing/testimonials.ts — so today this returns null
 * and the plan screen simply keeps its explanatory card. The moment real
 * quotes are added it appears, with no further work.
 *
 * That is why this is a component reading data rather than markup with the
 * words baked in: "we have no testimonials yet" and "here are our
 * testimonials" are the same code path, and the empty case cannot be
 * forgotten about.
 */

/** Long enough to read a short quote without feeling stuck. */
const ROTATE_MS = 7000;

function Stars({ score, outOf }: { score: number; outOf: number }) {
  return (
    <span
      className="flex gap-0.5"
      // The number is what matters; five separate icons read as noise.
      aria-label={`${score} out of ${outOf}`}
    >
      {Array.from({ length: outOf }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i < Math.round(score)
              ? "size-3.5 fill-primary text-primary"
              : "size-3.5 text-muted-foreground/30"
          }
        />
      ))}
    </span>
  );
}

function Card({ item }: { item: Testimonial }) {
  const initials = item.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <figure className="relative rounded-2xl border bg-background/90 p-6 shadow-sm backdrop-blur">
      <Quote
        className="absolute top-5 right-5 size-6 text-primary/15"
        aria-hidden="true"
      />
      <blockquote className="text-sm leading-relaxed text-balance">
        &ldquo;{item.quote}&rdquo;
      </blockquote>

      <figcaption className="mt-4 flex items-center gap-3">
        {item.avatar ? (
          <img
            src={item.avatar}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          /*
            Initials rather than a stock portrait. A bought photograph
            standing in for a named customer is a fake face on a real quote.
          */
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initials}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {item.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.role}
          </span>
        </span>
        {item.verified ? (
          <span className="ml-auto shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            Verified customer
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function TestimonialRail() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (TESTIMONIALS.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % TESTIMONIALS.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // Nothing true to show: render nothing at all.
  if (TESTIMONIALS.length === 0 && !REVIEW_SCORE) return null;

  const item = TESTIMONIALS[index] ?? null;

  return (
    <div className="space-y-4">
      {item ? <Card item={item} /> : null}

      {/* Dots, so someone can go back to a quote they were reading. */}
      {TESTIMONIALS.length > 1 ? (
        <div className="flex justify-center gap-1.5">
          {TESTIMONIALS.map((t, i) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show quote ${i + 1}`}
              aria-current={i === index}
              className={`size-2 rounded-full transition-colors ${
                i === index ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      ) : null}

      {/*
        The review badge. Links to the real profile so the score can be
        checked — a rating nobody can verify is just a number we wrote.
      */}
      {REVIEW_SCORE ? (
        <a
          href={REVIEW_SCORE.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-xs backdrop-blur transition-colors hover:bg-background"
        >
          <Stars score={REVIEW_SCORE.score} outOf={REVIEW_SCORE.outOf} />
          <span className="font-semibold">
            {REVIEW_SCORE.score}/{REVIEW_SCORE.outOf}
          </span>
          <span className="text-muted-foreground">
            on {REVIEW_SCORE.platform} &middot; {REVIEW_SCORE.count} reviews
          </span>
        </a>
      ) : null}
    </div>
  );
}
