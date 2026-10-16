import { ArrowRight, Plus, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TestimonialCard } from "@/components/testimonial-card";
import { format } from "@/lib/i18n/format";
import { CASE_STUDY_PATH, CASE_STUDY_TESTIMONIAL } from "@/lib/marketing/case-study-image-studio";
import { REVIEW_SCORE, type ReviewScore, type Testimonial } from "@/lib/marketing/testimonials";
import { OFFSCREEN, type SectionProps } from "./home-sections";

/**
 * Quotes from people who use RepGet, in the client's card design
 * (2026-10-11 package, "repget-approved-layout-direction"): a left-aligned
 * heading with a grey second line, white cards with a 64px round picture,
 * the name and role beside it and the quote below (components/
 * testimonial-card.tsx), three columns on a computer, two on a tablet, one
 * on a phone, and the cards past the ninth behind a dark "View more" pill.
 *
 * The cards come from the page: the homepages pass the PUBLISHED cards from
 * Admin -> Testimonials (lib/marketing/testimonials-db.ts), the admin design
 * preview passes drafts too. With no card and no review score the section
 * renders nothing at all, heading included, so the page reads straight from
 * the dashboard to pricing.
 *
 * "View more" is a native <details>: no script, the hidden cards are in the
 * HTML for anything reading the page, and keyboards and screen readers get
 * a real control for free.
 */

/** Cards shown before "View more" (the design: three full rows on a computer). */
const VISIBLE = 9;

export function Testimonials({
  t,
  href,
  testimonials,
  reviewScore = REVIEW_SCORE,
}: Pick<SectionProps, "t" | "href"> & {
  testimonials: Testimonial[];
  reviewScore?: ReviewScore | null;
}) {
  if (testimonials.length === 0 && !reviewScore) return null;

  const shown = testimonials.slice(0, VISIBLE);
  const more = testimonials.slice(VISIBLE);
  /*
    The quote the case study is about links to its numbers, and says what the
    case study says: Image Studio and RepGet have the same owner
    (lib/marketing/case-study-image-studio.ts). Matched by name, as written in
    Admin -> Testimonials, give or take case and spaces.
  */
  const caseStudy = href(CASE_STUDY_PATH);
  const isCaseStudy = (item: Testimonial) => item.name.trim().toLowerCase() === CASE_STUDY_TESTIMONIAL.toLowerCase();
  const hasCaseStudy = testimonials.some(isCaseStudy);
  const extrasFor = (item: Testimonial) =>
    isCaseStudy(item) ? { link: { href: caseStudy, label: t.testimonialsCaseStudyCard }, note: t.testimonialsSameOwner } : {};
  const grid = `grid grid-cols-1 gap-3 ${
    testimonials.length === 1 ? "max-w-xl" : testimonials.length === 2 ? "max-w-4xl sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
  }`;

  return (
    <section id="testimonials" className={`${OFFSCREEN} scroll-mt-28 border-t px-4 py-20`}>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.testimonialsEyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t.testimonialsTitle}
          <span className="block text-muted-foreground">{t.testimonialsSub}</span>
        </h2>

        {reviewScore ? (
          // A score a reader can check: it links to the public profile it came from.
          <p className="mt-6 flex">
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

        {/* The numbers behind one of the quotes (client, 2026-10-15: link the case study from the homepage and testimonials) - only when that quote is shown. */}
        {hasCaseStudy ? (
          <p className="mt-5">
            <Link href={caseStudy} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t.testimonialsCaseStudy}
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </p>
        ) : null}

        {shown.length > 0 ? (
          <ul className={`mt-10 ${grid}`}>
            {shown.map((item, index) => (
              <TestimonialCard key={`${index}-${item.name}`} item={item} verifiedLabel={t.testimonialsVerified} {...extrasFor(item)} />
            ))}
          </ul>
        ) : null}

        {more.length > 0 ? (
          <details className="group mt-3">
            <summary className="mx-auto mt-5 flex w-fit cursor-pointer list-none items-center gap-3 rounded-full bg-foreground py-2 pr-4 pl-3 text-sm font-semibold text-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-primary/40 group-open:hidden [&::-webkit-details-marker]:hidden">
              {/* The pictures of the cards it opens, as in the design. */}
              <span className="flex" aria-hidden="true">
                {more
                  .filter((item) => item.avatar)
                  .slice(0, 4)
                  .map((item, index) => (
                    <Image
                      key={`${index}-${item.avatar}`}
                      src={item.avatar!}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="-ml-2 size-7 rounded-full border-2 border-foreground object-cover first:ml-0"
                    />
                  ))}
              </span>
              {t.testimonialsMore}
              <span className="flex size-6 items-center justify-center rounded-full border border-background/70">
                <Plus className="size-3.5" aria-hidden="true" />
              </span>
            </summary>
            <ul className={grid}>
              {more.map((item, index) => (
                <TestimonialCard key={`${VISIBLE + index}-${item.name}`} item={item} verifiedLabel={t.testimonialsVerified} {...extrasFor(item)} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
