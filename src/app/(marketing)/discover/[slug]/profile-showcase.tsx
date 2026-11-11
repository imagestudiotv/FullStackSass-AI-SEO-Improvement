"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { CommentCompose, CommentList, usePostEngagement } from "@/components/blog-engagement/blog-engagement";
import type { PostEngagement } from "@/lib/blog/engagement";
import { loadUpvotesThisWeek, recordDiscoverView } from "@/lib/discover/actions";
import type { CommentsCopy } from "@/lib/i18n/blog-engagement";
import type { Locale } from "@/lib/i18n/config";
import { fillDiscover, type DiscoverProfileCopy } from "@/lib/i18n/discover";

import styles from "./profile.module.css";

const VISIT = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const UP = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 5-7 8h4v6h6v-6h4l-7-8Z" />
  </svg>
);
const COPY = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="13" height="13" x="8" y="8" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  </svg>
);
const BUBBLE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4.1-.9L3 21l1.9-5.4a9 9 0 0 1-.9-4.1A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
  </svg>
);

/** A stat as the design shows it: 222, 2k (compact from a thousand on). */
export function statValue(n: number, locale: Locale): string {
  if (n < 1000) return String(n);
  const text = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return locale === "en" ? text.replace("K", "k") : text;
}

/**
 * The interactive part of a business's profile (client's design, 2026-11-11
 * round 2, repget_customer_showcase_centered.html): the Visit / Upvote / Copy
 * link buttons, the three stats and the comments, around the parts the
 * server renders (`head`, `visual`, `sections`). The upvotes and comments are
 * the customer story's own (components/blog-engagement): one upvote per
 * member, toggled; a visitor is sent to sign-in and back. The view is counted
 * once the page is open (lib/discover/actions.ts).
 */
export function ProfileShowcase({
  locale,
  copy,
  commentsCopy,
  postId,
  name,
  websiteUrl,
  path,
  shareUrl,
  initial,
  commentTotal,
  upvotesWeek,
  impressionsWeek,
  head,
  visual,
  sections,
  footer,
}: {
  locale: Locale;
  copy: DiscoverProfileCopy;
  commentsCopy: CommentsCopy;
  postId: string;
  name: string;
  websiteUrl: string | null;
  /** The page's own path (sign-in returns here). */
  path: string;
  /** The canonical profile address, absolute: what Copy link copies. */
  shareUrl: string;
  /** The public engagement (no viewer); null when it could not be read. */
  initial: PostEngagement | null;
  /** Shown comments in all (the list holds up to the newest 200). */
  commentTotal: number;
  upvotesWeek: number;
  impressionsWeek: number;
  head: ReactNode;
  visual: ReactNode;
  sections: ReactNode;
  footer: ReactNode;
}) {
  const [week, setWeek] = useState(upvotesWeek);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counted = useRef(false);
  const titleId = useId();
  const engagement = usePostEngagement({
    postId,
    path,
    copy: commentsCopy,
    initial,
    upvoteReturn: path,
    onUpvoted: () => {
      loadUpvotesThisWeek(postId)
        .then(setWeek)
        .catch(() => {
          // The week's figure stays until the next visit.
        });
    },
  });
  const { state, busy, votePost, signInHref, signUpHref } = engagement;
  const initialShown = initial?.comments.length ?? 0;
  const comments = Math.max(0, commentTotal + (state.comments.length - initialShown));

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    recordDiscoverView(postId).catch(() => {
      // Not counted; nothing to tell the reader.
    });
  }, [postId]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function notice(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function copyLink() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = shareUrl;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      area.remove();
    }
    notice(copied ? copy.copied : fillDiscover(copy.copyFailed, { url: shareUrl }));
  }

  return (
    <article className={styles.profile}>
      <header>
        {head}
        <div className={styles.buttons}>
          {websiteUrl ? (
            <a className={styles.visit} href={websiteUrl} target="_blank" rel="noopener noreferrer">
              {copy.visitWebsite} {VISIT}
            </a>
          ) : (
            <span className={styles.pendingWebsite}>{copy.websitePending}</span>
          )}
          <button
            className={styles.vote}
            type="button"
            aria-pressed={state.upvoted}
            aria-label={fillDiscover(state.upvoted ? copy.removeUpvote : copy.upvoteLabel, { name })}
            onClick={votePost}
            disabled={busy === "post"}
          >
            {UP} <span>{state.upvotes}</span>
            <span className={styles.dividerBtn}>·</span>
            {copy.upvote}
          </button>
          <button className={styles.share} type="button" aria-label={copy.copyLabel} onClick={copyLink}>
            {COPY}
            <span>{copy.copyLink}</span>
          </button>
        </div>

        {visual}

        <div className={styles.stats} role="group" aria-label={copy.statsLabel}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{copy.upvotes}</span>
            <strong className={styles.statValue}>{statValue(week, locale)}</strong>
            <span className={styles.statNote}>{copy.thisWeek}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{copy.comments}</span>
            <strong className={styles.statValue}>{statValue(comments, locale)}</strong>
            <span className={styles.statNote}>{copy.discussions}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>{copy.impressions}</span>
            <strong className={styles.statValue}>{statValue(impressionsWeek, locale)}</strong>
            <span className={styles.statNote}>{copy.thisWeek}</span>
          </div>
        </div>
      </header>

      <div className={styles.profileContent}>
        {sections}

        <section className={`${styles.section} ${styles.comments}`} id="comments" aria-labelledby={titleId}>
          <div className={styles.commentsTitle}>
            <h2 id={titleId}>{copy.commentsTitle}</h2>
            <span className={styles.count}>{comments}</span>
          </div>
          <p className={styles.commentIntro}>{copy.commentIntro}</p>
          <div className={styles.engagement}>
            {state.signedIn ? (
              <CommentCompose engagement={engagement} copy={commentsCopy} />
            ) : (
              <div className={styles.commentBox}>
                <div className={styles.top}>
                  <div className={styles.commentIcon}>{BUBBLE}</div>
                  <div>
                    <strong>{copy.joinTitle}</strong>
                    <p>{copy.joinText}</p>
                  </div>
                </div>
                <a className={styles.signin} href={signInHref}>
                  {copy.signIn} <span aria-hidden="true">↗</span>
                </a>
                <a className={styles.signup} href={signUpHref}>
                  {copy.createAccount}
                </a>
              </div>
            )}
            <CommentList engagement={engagement} copy={commentsCopy} locale={locale} empty={<p className={styles.noComments}>{copy.noComments}</p>} />
          </div>
        </section>

        {footer}
      </div>

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </article>
  );
}
