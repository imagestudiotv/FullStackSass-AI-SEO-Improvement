"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";

import { walkthroughEmbedUrl } from "@/lib/marketing/walkthrough";

import styles from "./sections/reviews.module.css";

/**
 * The interactive parts of the homepage's customer stories
 * (sections/reviews.tsx), as the design's `rt-outrank-inspired-reviews-
 * interactions` script does them: a card's "Read more", "Show more reviews",
 * and the platform video that loads only when play is pressed.
 * They receive plain strings only.
 */

/** The design's class names, through the module. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/** One published card, as the server hands it over. */
export type ReviewItem = {
  name: string;
  role: string;
  quote: string;
  avatar: string | null;
  initials: string;
  /** The small line above the quote, for the reviewers the design names. */
  tag?: string;
  /** "Original review". */
  link: { href: string; label: string };
};

export type ReviewCardLabels = { readMore: string; readLess: string; reviewFrom: string };

export function ReviewCard({ item, labels }: { item: ReviewItem; labels: ReviewCardLabels }) {
  const [open, setOpen] = useState(false);
  const quoteId = useId();

  return (
    <article className={c(open ? "rt-card rt-expanded" : "rt-card")} aria-label={labels.reviewFrom.replace("{name}", item.name)}>
      <div className={c("rt-card-header")}>
        <span className={c("rt-avatar rt-avatar-md")} aria-hidden="true">
          <span>{item.initials}</span>
          {/* Ready-sized 128px files, served as they are (components/testimonial-card.tsx). */}
          {item.avatar ? <Image src={item.avatar} alt="" width={84} height={84} unoptimized /> : null}
        </span>
        <div className={c("rt-reviewer")}>
          <strong>{item.name}</strong>
          <small lang="en">{item.role}</small>
        </div>
        <span className={c("rt-quote-symbol")} aria-hidden="true">
          &ldquo;
        </span>
      </div>
      {item.tag ? <p className={c("rt-review-tag")}>{item.tag}</p> : null}
      {/* Every published card is in English so far; lang keeps a translated page from reading it in another voice. */}
      <p className={c("rt-copy")} id={quoteId} lang="en">
        {item.quote}
      </p>
      <div className={c("rt-card-bottom")}>
        <button type="button" className={c("rt-read")} aria-expanded={open} aria-controls={quoteId} onClick={() => setOpen((value) => !value)}>
          {open ? labels.readLess : labels.readMore} <span aria-hidden="true">+</span>
        </button>
        <Link prefetch={false} className={c("rt-original")} href={item.link.href}>
          {item.link.label} <span aria-hidden="true">&#8599;</span>
        </Link>
      </div>
    </article>
  );
}

/**
 * The cards past the first six, hidden until "Show more reviews", and the
 * two buttons under the masonry. Without more cards there is nothing to
 * show, so only "All customer feedback" remains.
 */
export function MoreReviews({
  children,
  hasMore,
  labels,
  allHref,
}: {
  children?: ReactNode;
  hasMore: boolean;
  labels: { showMore: string; showLess: string; allFeedback: string };
  allHref: string;
}) {
  const [opened, setOpened] = useState(false);
  const gridId = useId();
  const grid = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !opened;
    setOpened(next);
    if (next) {
      // After the grid is shown: bring it into view, as the design does.
      requestAnimationFrame(() => {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        grid.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest" });
      });
    }
  };

  return (
    <>
      {hasMore ? (
        <div className={c("rt-more-grid")} id={gridId} ref={grid} hidden={!opened}>
          {children}
        </div>
      ) : null}
      <div className={c("rt-actions")}>
        {hasMore ? (
          <button type="button" className={c("rt-showmore")} aria-controls={gridId} aria-expanded={opened} onClick={toggle}>
            {opened ? labels.showLess : labels.showMore} <span aria-hidden="true">{opened ? "-" : "+"}</span>
          </button>
        ) : null}
        <Link prefetch={false} className={c("rt-all-reviews")} href={allHref}>
          {labels.allFeedback} &#8599;
        </Link>
      </div>
    </>
  );
}

export type VideoCardCopy = {
  videoTag: string;
  uiLines: [string, string, string];
  playLabel: string;
  videoOverline: string;
  frameTitle: string;
  videoCaption: string;
  videoTitle: string;
  videoNote: string;
  videoLink: string;
};

/**
 * The dark "Platform video" card in the middle: a drawing of the product
 * that straightens on hover, and a play button that loads RepGet's own
 * walkthrough (lib/marketing/walkthrough.ts) inside it. Nothing is requested
 * from YouTube before the press.
 */
export function VideoCard({ t, lang }: { t: VideoCardCopy; lang: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={c("rt-video-card")}>
      <div className={c("rt-video-surface")}>
        <div className={c("rt-video-tag")}>
          <span className={c("rt-video-dot")} /> {t.videoTag}
        </div>
        <div className={c("rt-demo-illustration")} aria-hidden="true">
          <div className={c("rt-ui-window")}>
            <div className={c("rt-ui-window-top")}>
              <span className={c("rt-ui-mark")}>R</span> RepGet <span className={c("rt-ui-top-dots")}>&bull;&nbsp;&bull;&nbsp;&bull;</span>
            </div>
            <div className={c("rt-ui-bars")}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            {t.uiLines.map((line) => (
              <div key={line} className={c("rt-ui-tasks")}>
                <i />
                <b>{line}</b>
              </div>
            ))}
          </div>
        </div>
        {/* Once playing, the player covers the surface; the button goes, so it is not a hidden tab stop. */}
        {playing ? null : (
          <button className={c("rt-video-play")} type="button" aria-label={t.playLabel} onClick={() => setPlaying(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="m8 4 12 8-12 8V4Z" />
            </svg>
          </button>
        )}
        <div className={c("rt-video-overline")} aria-hidden="true">
          {t.videoOverline} <span>&#8599;</span>
        </div>
        {playing ? (
          <iframe
            className={c("rt-video-frame")}
            title={t.frameTitle}
            src={walkthroughEmbedUrl(lang)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : null}
      </div>
      <div className={c("rt-video-footer")}>
        <span className={c("rt-video-caption-small")}>{t.videoCaption}</span>
        <h3>{t.videoTitle}</h3>
        <p>{t.videoNote}</p>
        <a href="#repget-demo-video">
          {t.videoLink} <span aria-hidden="true">&#8599;</span>
        </a>
      </div>
    </div>
  );
}
