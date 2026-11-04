import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { copilotFounderReviewsCopy } from "@/lib/i18n/home/copilot-founder-reviews";
import { CASE_STUDY_PATH, CASE_STUDY_TESTIMONIAL } from "@/lib/marketing/case-study-image-studio";
import type { Testimonial } from "@/lib/marketing/testimonials";

import { lettersOf, photoOf } from "../review-people";
import { MoreReviews, ReviewCard, VideoCard, type ReviewItem } from "../reviews-grid";
import type { SectionProps } from "../types";
import styles from "./reviews.module.css";

/** The design's class names, through the module. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/** Cards in the masonry before "Show more reviews": three either side of the video. */
const VISIBLE = 6;

/** The design's icon for each ticker pill, in the order of the copy's `pills`. */
const PILL_ICONS: ReactNode[] = [
  <Fragment key="0">
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m16 16 4.1 4.1" />
  </Fragment>,
  <Fragment key="1">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Fragment>,
  <path key="5" d="M3 17 10 10l4 4 7-7M16 7h5v5" />,
  <path key="6" d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 17l.7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17Z" />,
  <Fragment key="2">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2" />
  </Fragment>,
  <Fragment key="3">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l4 2" />
  </Fragment>,
  <path key="7" d="M9 8H8a5 5 0 0 0 0 10h2m4-10h2a5 5 0 0 1 0 10h-2M8 13h8" />,
  <Fragment key="4">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
  </Fragment>,
];

/**
 * Customer stories (client's design, design.html `#repget-reviews`).
 *
 * ONLY the published cards from Admin -> Testimonials: none published, and
 * the whole section is not rendered, so the page reads straight on to
 * pricing (the hero's "reviews" link only appears in the same case).
 *
 * The masonry is the design's: the first three cards on the left, the
 * platform video in the middle, the next three on the right, the rest behind
 * "Show more reviews". With fewer cards they are shared between the two
 * sides; a single card stands beside the video.
 *
 * A testimonial stores no tag line ("SEARCH VISIBILITY") nor a link to where
 * it was first published (lib/marketing/testimonials.ts). The tags go by
 * reviewer, so a new card simply has none. "Original review" is
 * the Image Studio case study for that quote and otherwise Success Stories,
 * where "View the originals" goes too.
 */
export function Reviews({ locale, href, testimonials }: SectionProps & { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  const t = copilotFounderReviewsCopy(locale).reviews;
  const stories = href("/success-stories");
  const caseStudy = href(CASE_STUDY_PATH);
  const isCaseStudy = (item: Testimonial) => item.name.trim().toLowerCase() === CASE_STUDY_TESTIMONIAL.toLowerCase();

  const items: ReviewItem[] = testimonials.map((item) => ({
    name: item.name,
    role: item.role,
    quote: item.quote,
    avatar: photoOf(item.avatar),
    initials: lettersOf(item.name),
    tag: t.tags[item.name.trim().toLowerCase()],
    link: { href: isCaseStudy(item) ? caseStudy : stories, label: t.originalReview },
  }));

  const shown = items.slice(0, VISIBLE);
  const half = Math.ceil(shown.length / 2);
  const left = shown.slice(0, half);
  const right = shown.slice(half);
  const more = items.slice(VISIBLE);

  const labels = { readMore: t.readMore, readLess: t.readLess, reviewFrom: t.reviewFrom };
  const cards = (list: ReviewItem[], offset: number) =>
    list.map((item, index) => <ReviewCard key={`${offset + index}-${item.name}`} item={item} labels={labels} />);

  const pills = t.pills.map((label, index) => ({ label, icon: PILL_ICONS[index] }));
  const track = (list: typeof pills) =>
    list.map(({ label, icon }) => (
      <li key={label} className={c("rt-pill")}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
        {label}
      </li>
    ));
  const reversed = [...pills].reverse();

  return (
    <section className={c("rt-testimonials")} id="repget-reviews" aria-labelledby="rt-heading">
      <div className={c("rt-content")}>
        <div className={c("rt-section-kicker")}>
          <span className={c("rt-kicker-dot")} /> {t.kicker}
        </div>
        <h2 id="rt-heading">
          {t.titleLead} <em>{t.titleAccent}</em>
        </h2>
        <p className={c("rt-section-lead")}>{t.lead}</p>
        <div className={c("rt-social-proof")}>
          {/* The faces of the real reviewers below; initials where a card has no photograph. */}
          <div className={c("rt-avatar-row")} aria-hidden="true">
            {items.slice(0, 5).map((item, index) => (
              <span key={`${index}-${item.name}`} className={c("rt-avatar rt-avatar-sm")}>
                <span>{item.initials}</span>
                {item.avatar ? <Image src={item.avatar} alt="" width={66} height={66} unoptimized /> : null}
              </span>
            ))}
          </div>
          <span>
            <strong>{t.proofStrong}</strong> {t.proofRest}
          </span>
          <span className={c("rt-social-line")} aria-hidden="true" />
          <Link prefetch={false} href={stories}>
            {t.viewOriginals} <span aria-hidden="true">&#8599;</span>
          </Link>
        </div>
      </div>

      {/*
        Two rows drifting opposite ways; hovering pauses them. The first copy
        of the first row is the readable one; its duplicate (which makes the
        loop seamless) and the reversed second row are decoration.
      */}
      <div className={c("rt-tickers")} role="group" aria-label={t.tickerLabel}>
        <div className={c("rt-track")}>
          <ul className={c("rt-track-copy")}>{track(pills)}</ul>
          <ul className={c("rt-track-copy")} aria-hidden="true">
            {track(pills)}
          </ul>
        </div>
        <div className={c("rt-track rt-reverse")} aria-hidden="true">
          <ul className={c("rt-track-copy")}>{track(reversed)}</ul>
          <ul className={c("rt-track-copy")}>{track(reversed)}</ul>
        </div>
      </div>

      <div className={c("rt-content rt-cards-wrap")}>
        <div className={c(right.length > 0 ? "rt-masonry" : "rt-masonry rt-masonry-two")}>
          <div className={c("rt-col")}>{cards(left, 0)}</div>
          <div className={c("rt-center")}>
            <VideoCard
              lang={locale}
              t={{
                videoTag: t.videoTag,
                uiLines: t.uiLines,
                playLabel: t.playLabel,
                videoOverline: t.videoOverline,
                frameTitle: t.frameTitle,
                videoCaption: t.videoCaption,
                videoTitle: t.videoTitle,
                videoNote: t.videoNote,
                videoLink: t.videoLink,
              }}
            />
          </div>
          {right.length > 0 ? <div className={c("rt-col")}>{cards(right, left.length)}</div> : null}
        </div>
        <MoreReviews
          hasMore={more.length > 0}
          allHref={stories}
          labels={{ showMore: t.showMore, showLess: t.showLess, allFeedback: t.allFeedback }}
        >
          {cards(more, VISIBLE)}
        </MoreReviews>
      </div>
    </section>
  );
}
