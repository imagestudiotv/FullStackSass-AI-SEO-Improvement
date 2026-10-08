import { BadgeCheck, Star } from "lucide-react";
import Image from "next/image";

import { format } from "@/lib/i18n/format";
import {
  REVIEW_SCORE,
  TESTIMONIALS,
  type ReviewScore,
  type Testimonial,
} from "@/lib/marketing/testimonials";
import { OFFSCREEN, SectionHeading, type SectionProps } from "./home-sections";

/**
 * Quotes from people who use RepGet, in the design's card layout.
 *
 * Reads lib/marketing/testimonials.ts and NOTHING else: no placeholder cards,
 * no sample names, no rating badge until those lists hold real, approved
 * entries. With both empty - as they are until quotes are approved in
 * writing - the section renders nothing at all, heading included, so the
 * page reads straight from the dashboard to pricing.
 *
 * The props default to the real sources; tests pass their own.
 */
export function Testimonials({
  t,
  testimonials = TESTIMONIALS,
  reviewScore = REVIEW_SCORE,
}: Pick<SectionProps, "t"> & {
  testimonials?: Testimonial[];
  reviewScore?: ReviewScore | null;
}) {
  if (testimonials.length === 0 && !reviewScore) return null;

  return (
    <section className={`${OFFSCREEN} border-t px-4 py-20`}>
      <div className="mx-auto max-w-6xl">
        <SectionHeading center eyebrow={t.testimonialsEyebrow} title={t.testimonialsTitle} />

        {reviewScore ? (
          // A score a reader can check: it links to the public profile it came from.
          <p className="mt-5 flex justify-center">
            <a
              href={reviewScore.url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium hover:border-primary/40"
            >
              <Star className="size-4 fill-current text-primary" aria-hidden="true" />
              {format(t.reviewScore, {
                score: reviewScore.score,
                outOf: reviewScore.outOf,
                platform: reviewScore.platform,
                count: reviewScore.count,
              })}
              <span className="sr-only">{t.opensInNewTab}</span>
            </a>
          </p>
        ) : null}

        {testimonials.length > 0 ? (
          <ul
            className={`mx-auto mt-12 grid grid-cols-1 gap-5 ${ testimonials.length === 1 ? "max-w-xl" : testimonials.length === 2 ? "max-w-4xl md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3" }`}
          >
            {testimonials.map((item) => (
              <li key={`${item.name}-${item.role}`}>
                <figure className="flex h-full flex-col rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-20px_rgba(0,0,0,0.18)]">
                  <blockquote className="flex-1 text-pretty text-foreground">
                    <p>&ldquo;{item.quote}&rdquo;</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t pt-5">
                    {item.avatar ? (
                      <Image
                        src={item.avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      // Initials, not a stock face standing in for a real person.
                      <span
                        aria-hidden="true"
                        className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-strong"
                      >
                        {initials(item.name)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {item.name}
                        {item.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <BadgeCheck className="size-3.5" aria-hidden="true" />
                            {t.testimonialsVerified}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-sm text-muted-foreground">{item.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** "Ada Lovelace" -> "AL"; one name -> its first letter. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}
