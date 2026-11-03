"use client";

import { ArrowUpRight, BadgeCheck, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { initials } from "@/components/testimonial-card";
import type { Testimonial } from "@/lib/marketing/testimonials";
import styles from "./home.module.css";
import local from "./sections/closing.module.css";

/** One published card, as the server hands it over: plain data only. */
export type ReviewItem = Pick<Testimonial, "quote" | "name" | "role" | "avatar" | "verified"> & {
  /** The case study behind the quote, for the card it belongs to. */
  link?: { href: string; label: string };
};

export type ReviewLabels = {
  readMore: string;
  readLess: string;
  showMore: string;
  showLess: string;
  verified: string;
};

/*
  False on the server and during hydration, true afterwards - without a
  setState in an effect. Everything this file hides (the clamped quotes, the
  cards past the first few) is only hidden once it is true, so a page
  without JavaScript, or a crawler, reads every word.
*/
const subscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * The quote cards of the homepage's reviews: the first `visible` in a
 * masonry, the rest behind "Show more reviews".
 */
export function ReviewsGrid({ items, labels, visible }: { items: ReviewItem[]; labels: ReviewLabels; visible: number }) {
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();

  const shown = items.slice(0, visible);
  const more = items.slice(visible);

  return (
    <>
      <div className={local.flow} style={{ "--cols": Math.min(shown.length, 3) } as CSSProperties}>
        {shown.map((item, index) => (
          <ReviewCard key={`${index}-${item.name}`} item={item} labels={labels} hydrated={hydrated} />
        ))}
      </div>

      {more.length > 0 ? (
        <>
          <div id={moreId} className={styles.moreGrid} hidden={hydrated && !expanded}>
            {more.map((item, index) => (
              <ReviewCard key={`${visible + index}-${item.name}`} item={item} labels={labels} hydrated={hydrated} />
            ))}
          </div>
          {/* A button that does nothing without JavaScript is not shown without it. */}
          {hydrated ? (
            <div className={styles.reviewsActions}>
              <button
                type="button"
                className={`${styles.pillButton} ${local.focusRing}`}
                aria-expanded={expanded}
                aria-controls={moreId}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? labels.showLess : labels.showMore}
                {expanded ? (
                  <Minus className={local.readIcon} aria-hidden="true" />
                ) : (
                  <Plus className={local.readIcon} aria-hidden="true" />
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ReviewCard({ item, labels, hydrated }: { item: ReviewItem; labels: ReviewLabels; hydrated: boolean }) {
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const quoteId = useId();
  const [open, setOpen] = useState(false);
  // Whether the four-line clamp actually cuts this quote: a short one gets no button.
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = quoteRef.current;
    if (!el || !hydrated || open) return;
    // Measured, not guessed from the length: the clamp depends on the column width.
    const observer = new ResizeObserver(() => setClipped(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hydrated, open]);

  const clamped = hydrated && !open;

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewHead}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(item.name)}
          {/* Ready-sized 128px files, served as they are (components/testimonial-card.tsx). */}
          {item.avatar ? <Image src={item.avatar} alt="" width={84} height={84} unoptimized /> : null}
        </span>
        <div className={styles.reviewer}>
          <strong>{item.name}</strong>
          <small lang="en">{item.role}</small>
          {/* A claim about who they are, so only where the card says so. */}
          {item.verified ? (
            <span className={styles.verified}>
              <BadgeCheck className={local.readIcon} aria-hidden="true" />
              {labels.verified}
            </span>
          ) : null}
        </div>
        <span className={styles.quoteMark} aria-hidden="true">
          &ldquo;
        </span>
      </div>

      {/* Every published card is in English so far; lang keeps a translated page from reading it as Italian. */}
      <blockquote lang="en">
        <p ref={quoteRef} id={quoteId} className={clamped ? styles.quote : `${styles.quote} ${styles.quoteOpen}`}>
          {item.quote}
        </p>
      </blockquote>

      {clipped || open || item.link ? (
        <div className={local.cardFoot}>
          {clipped || open ? (
            <button
              type="button"
              className={`${styles.readMore} ${local.focusRing}`}
              aria-expanded={open}
              aria-controls={quoteId}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? labels.readLess : labels.readMore}
              {open ? <Minus className={local.readIcon} aria-hidden="true" /> : <Plus className={local.readIcon} aria-hidden="true" />}
            </button>
          ) : (
            <span />
          )}
          {item.link ? (
            <Link href={item.link.href} className={`${local.cardLink} ${local.focusRing}`}>
              {item.link.label}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
