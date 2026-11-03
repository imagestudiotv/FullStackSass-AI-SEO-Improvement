import { CalendarCheck, Clock, Inbox, Link2, ListChecks, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { initials } from "@/components/testimonial-card";
import { CASE_STUDY_PATH, CASE_STUDY_TESTIMONIAL } from "@/lib/marketing/case-study-image-studio";
import type { Testimonial } from "@/lib/marketing/testimonials";
import styles from "../home.module.css";
import { ReviewsGrid, type ReviewItem } from "../reviews-grid";
import { rich } from "../text";
import type { SectionProps } from "../types";
import local from "./closing.module.css";

/**
 * What customers say (client's design, 2026-11-03: "Customer stories").
 *
 * ONLY the published cards from Admin -> Testimonials, as the old section
 * (testimonials-section.tsx): none published, and the whole section - pills
 * and heading included - is not rendered, so the page reads straight on to
 * pricing. The hero's "reviews" link only appears in the same case.
 *
 * The design's centre card is a platform video. It is left out: a
 * testimonial has no video (lib/marketing/testimonials.ts), and a walkthrough
 * of our own product sitting among customer quotes reads as one of them. The
 * walkthrough has its own section further up. Nor is there a star rating:
 * REVIEW_SCORE is null until a public profile with real reviews exists.
 */

/** Cards in the masonry before "Show more reviews" (the design: two full columns of three). */
const VISIBLE = 6;

/** One icon per ticker pill, in the order of `c.reviews.pills`. */
const PILL_ICONS: LucideIcon[] = [Search, CalendarCheck, Inbox, Sparkles, ListChecks, Clock, Link2, Users];

export function Reviews({ c, m, href, testimonials }: SectionProps & { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  const t = c.reviews;
  /*
    The quote the case study is about links to its numbers
    (lib/marketing/case-study-image-studio.ts), matched by name as the old
    section does.
  */
  const caseStudy = href(CASE_STUDY_PATH);
  const isCaseStudy = (item: Testimonial) => item.name.trim().toLowerCase() === CASE_STUDY_TESTIMONIAL.toLowerCase();
  const hasCaseStudy = testimonials.some(isCaseStudy);

  // Plain data for the client component: no Messages object crosses over.
  const items: ReviewItem[] = testimonials.map((item) => ({
    quote: item.quote,
    name: item.name,
    role: item.role,
    avatar: item.avatar ?? null,
    verified: item.verified ?? false,
    link: isCaseStudy(item) ? { href: caseStudy, label: m.home.testimonialsCaseStudyCard } : undefined,
  }));

  const pills = t.pills.map((label, index) => ({ label, Icon: PILL_ICONS[index % PILL_ICONS.length] }));
  const row = (list: typeof pills) =>
    list.map(({ label, Icon }) => (
      <li key={label} className={styles.tickerPill}>
        <Icon aria-hidden="true" />
        {label}
      </li>
    ));

  return (
    <section id="repget-reviews" className={styles.reviews} aria-labelledby="repget-reviews-title">
      <div className={`${styles.reviewsContent} ${styles.center} ${styles.reveal}`} data-reveal="">
        <p className={styles.kicker}>{t.kicker}</p>
        <h2 id="repget-reviews-title" className={styles.sectionTitle}>
          {rich(t.title)}
        </h2>
        <p className={styles.sectionSub}>{t.lead}</p>
        <div className={styles.proofRow}>
          {/* The faces of the real reviewers below; initials where a card has no photograph. */}
          <span className={styles.avatars} aria-hidden="true">
            {testimonials.slice(0, 5).map((item, index) => (
              <span key={`${index}-${item.name}`} className={styles.avatar}>
                {initials(item.name)}
                {item.avatar ? <Image src={item.avatar} alt="" width={60} height={60} unoptimized /> : null}
              </span>
            ))}
          </span>
          <span>{t.proof}</span>
          {hasCaseStudy ? (
            <Link href={caseStudy} className={`${local.inlineLink} ${local.focusRing}`}>
              {m.home.testimonialsCaseStudy}
            </Link>
          ) : null}
        </div>
      </div>

      {/*
        Two rows drifting opposite ways. The first copy of the first row is
        the readable one; its duplicate (which makes the loop seamless) and
        the reversed second row are decoration. Reduced motion stops them
        (home.module.css).
      */}
      <div className={styles.tickers}>
        <div className={styles.marqueeTrack}>
          <ul className={local.tickerGroup}>{row(pills)}</ul>
          <ul className={local.tickerGroup} aria-hidden="true">
            {row(pills)}
          </ul>
        </div>
        <div className={`${styles.marqueeTrack} ${styles.reverse}`} aria-hidden="true">
          <ul className={local.tickerGroup}>{row([...pills].reverse())}</ul>
          <ul className={local.tickerGroup}>{row([...pills].reverse())}</ul>
        </div>
      </div>

      <div className={`${styles.reviewsContent} ${styles.reveal}`} data-reveal="" data-delay="1">
        <ReviewsGrid
          items={items}
          visible={VISIBLE}
          labels={{
            readMore: t.readMore,
            readLess: t.readLess,
            showMore: t.showMore,
            showLess: t.showLess,
            verified: m.home.testimonialsVerified,
          }}
        />
      </div>
    </section>
  );
}
