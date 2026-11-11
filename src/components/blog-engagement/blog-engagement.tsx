"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { safeNext } from "@/lib/auth/next";
import {
  deleteMyComment,
  loadPostEngagement,
  postComment,
  toggleCommentUpvote,
  togglePostUpvote,
} from "@/lib/blog/engagement-actions";
import type { PostEngagement, PublicComment } from "@/lib/blog/engagement";
import type { CommentsCopy } from "@/lib/i18n/blog-engagement";
import type { Locale } from "@/lib/i18n/config";

import styles from "./blog-engagement.module.css";

const COMMENT_MAX = 750;
const DATE_LOCALES: Record<Locale, string> = { en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE" };

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/**
 * A post's comments and upvote state, and what changes them (client,
 * 2026-11-11). The page renders the public part (the counts and the
 * comments, with no viewer); this then asks the server who is reading
 * (lib/blog/engagement-actions.ts), so the page itself is the same for
 * everyone. Signed out, an upvote leads to sign-in (and back).
 *
 * Shared by the blog post's section (BlogEngagement, below) and a business's
 * profile in the customer directory (app/(marketing)/discover), whose
 * upvotes and comments are its customer story's own.
 */
export function usePostEngagement({
  postId,
  path,
  copy,
  initial,
  upvoteReturn,
  onUpvoted,
}: {
  postId: string;
  /** The page's own path: where sign-in and sign-up return to (at its comments). */
  path: string;
  copy: CommentsCopy;
  /** The public state, without a viewer; null when it could not be read. */
  initial: PostEngagement | null;
  /** Where sign-in returns to after a signed-out upvote; the comments by default. */
  upvoteReturn?: string;
  /** After the server has settled an upvote of the post. */
  onUpvoted?: (result: { upvoted: boolean; count: number }) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<PostEngagement>(
    initial ?? { postId, upvotes: 0, upvoted: false, comments: [], signedIn: false },
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, startPosting] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const loaded = useRef(false);

  const back = safeNext(`${path}#comments`);
  const signInHref = `/sign-in?next=${encodeURIComponent(back)}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(back)}`;
  const upvoteSignInHref = upvoteReturn ? `/sign-in?next=${encodeURIComponent(safeNext(upvoteReturn))}` : signInHref;

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadPostEngagement(postId)
      .then((result) => {
        if (result.ok) setState(result.data);
      })
      .catch(() => {
        // The public state stays; acting still works (each action checks the session).
      });
  }, [postId]);

  const toSignIn = () => router.push(signInHref);

  async function votePost() {
    if (!state.signedIn) return router.push(upvoteSignInHref);
    const on = !state.upvoted;
    setBusy("post");
    // At once on screen; put back if the server says otherwise.
    setState((current) => ({ ...current, upvoted: on, upvotes: Math.max(0, current.upvotes + (on ? 1 : -1)) }));
    try {
      const result = await togglePostUpvote(postId, on);
      if (result.ok) {
        setState((current) => ({ ...current, upvoted: result.data.upvoted, upvotes: result.data.count }));
        onUpvoted?.(result.data);
      } else if (result.error === "signed_out") router.push(upvoteSignInHref);
      else setState((current) => ({ ...current, upvoted: !on, upvotes: Math.max(0, current.upvotes + (on ? -1 : 1)) }));
    } catch {
      setState((current) => ({ ...current, upvoted: !on, upvotes: Math.max(0, current.upvotes + (on ? -1 : 1)) }));
    } finally {
      setBusy(null);
    }
  }

  function patchComment(id: string, change: Partial<PublicComment>) {
    setState((current) => ({ ...current, comments: current.comments.map((c) => (c.id === id ? { ...c, ...change } : c)) }));
  }

  async function voteComment(comment: PublicComment) {
    if (!state.signedIn) return toSignIn();
    const on = !comment.upvoted;
    setBusy(comment.id);
    patchComment(comment.id, { upvoted: on, upvotes: Math.max(0, comment.upvotes + (on ? 1 : -1)) });
    try {
      const result = await toggleCommentUpvote(comment.id, on);
      if (result.ok) patchComment(comment.id, { upvoted: result.data.upvoted, upvotes: result.data.count });
      else if (result.error === "signed_out") toSignIn();
      else patchComment(comment.id, { upvoted: comment.upvoted, upvotes: comment.upvotes });
    } catch {
      patchComment(comment.id, { upvoted: comment.upvoted, upvotes: comment.upvotes });
    } finally {
      setBusy(null);
    }
  }

  async function remove(comment: PublicComment) {
    setBusy(comment.id);
    try {
      const result = await deleteMyComment(comment.id);
      if (result.ok || result.error === "not_found") {
        setState((current) => ({ ...current, comments: current.comments.filter((c) => c.id !== comment.id) }));
      } else if (result.error === "signed_out") {
        toSignIn();
      }
    } catch {
      setError(copy.errors.failed);
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return setError(copy.errors.empty);
    if ([...text].length > COMMENT_MAX) return setError(copy.errors.tooLong);
    setError(null);
    startPosting(async () => {
      try {
        const result = await postComment(postId, text);
        if (result.ok) {
          setState(result.data);
          setBody("");
          return;
        }
        if (result.error === "signed_out") return toSignIn();
        setError(
          {
            empty: copy.errors.empty,
            too_long: copy.errors.tooLong,
            rate_limited: copy.errors.rateLimited,
            not_found: copy.errors.notFound,
          }[result.error],
        );
      } catch {
        setError(copy.errors.failed);
      }
    });
  }

  return {
    state,
    body,
    setBody,
    error,
    setError,
    posting,
    busy,
    confirming,
    setConfirming,
    signInHref,
    signUpHref,
    votePost,
    voteComment,
    remove,
    submit,
  };
}

export type PostEngagementControls = ReturnType<typeof usePostEngagement>;

/** The signed-in compose box; `actions` go before the submit button. */
export function CommentCompose({ engagement, copy, actions }: { engagement: PostEngagementControls; copy: CommentsCopy; actions?: ReactNode }) {
  const fieldId = useId();
  const { body, setBody, error, setError, posting, submit } = engagement;
  const length = [...body].length;
  return (
    <form className={styles.compose} onSubmit={submit} noValidate>
      <label htmlFor={fieldId} className="sr-only">
        {copy.label}
      </label>
      <textarea
        id={fieldId}
        className={styles.textarea}
        value={body}
        placeholder={copy.placeholder}
        rows={3}
        onChange={(event) => {
          setBody(event.target.value);
          if (error) setError(null);
        }}
        aria-invalid={length > COMMENT_MAX || undefined}
        aria-describedby={`${fieldId}-count`}
      />
      <div className={styles.composeRow}>
        <span id={`${fieldId}-count`} className={`${styles.counter} ${length > COMMENT_MAX ? styles.counterOver : ""}`}>
          {fill(copy.counter, { n: length, max: COMMENT_MAX })}
        </span>
        <div className={styles.actions}>
          {actions}
          <button className={styles.primary} type="submit" disabled={posting}>
            {posting ? copy.posting : copy.post}
          </button>
        </div>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** The shown comments, newest first, with their upvotes and the author's delete; `empty` when there are none. */
export function CommentList({
  engagement,
  copy,
  locale,
  empty,
}: {
  engagement: PostEngagementControls;
  copy: CommentsCopy;
  locale: Locale;
  /** Replaces the empty line (its own design's). */
  empty?: ReactNode;
}) {
  const { state, busy, confirming, setConfirming, voteComment, remove } = engagement;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  if (state.comments.length === 0) return empty ?? <p className={styles.empty}>{copy.empty}</p>;
  return (
    <ul className={styles.list}>
      {state.comments.map((comment) => (
        <li key={comment.id} className={styles.comment}>
          <div className={styles.meta}>
            <span className={styles.name}>{comment.authorName || copy.member}</span>
            <time className={styles.date} dateTime={comment.createdAt} suppressHydrationWarning>
              {date(comment.createdAt)}
            </time>
          </div>
          <p className={styles.text}>{comment.body}</p>
          <div className={styles.commentActions}>
            <button
              className={`${styles.upvote} ${styles.small}`}
              type="button"
              aria-pressed={comment.upvoted}
              aria-label={comment.upvoted ? copy.removeUpvote : copy.upvoteComment}
              onClick={() => voteComment(comment)}
              disabled={busy === comment.id}
            >
              <span className={styles.arrow} aria-hidden="true">
                ↑
              </span>
              <span className={styles.total}>{comment.upvotes}</span>
            </button>
            {comment.own ? (
              confirming === comment.id ? (
                <>
                  <span className={styles.confirm}>{copy.confirmDelete}</span>
                  <button className={styles.link} type="button" onClick={() => remove(comment)} disabled={busy === comment.id}>
                    {copy.delete}
                  </button>
                  <button className={styles.link} type="button" onClick={() => setConfirming(null)}>
                    {copy.cancel}
                  </button>
                </>
              ) : (
                <button className={styles.link} type="button" onClick={() => setConfirming(comment.id)}>
                  {copy.delete}
                </button>
              )
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A blog post's comments and upvote (client, 2026-11-11), in the reader's
 * language. Signed out: the design's gate, and Upvote leads to sign-in (and
 * back here). Signed in: a compact compose box in the gate's place.
 *
 * Comments are plain text, rendered as text (React escapes them; no links).
 */
export function BlogEngagement({
  postId,
  locale,
  copy,
  path,
  initial,
}: {
  postId: string;
  locale: Locale;
  copy: CommentsCopy;
  /** The post's own path: where sign-in and sign-up return to. */
  path: string;
  /** The public state, without a viewer; null when it could not be read. */
  initial: PostEngagement | null;
}) {
  const engagement = usePostEngagement({ postId, path, copy, initial });
  const { state, busy, votePost, signInHref, signUpHref } = engagement;
  const titleId = useId();

  const postUpvote = (
    <button
      className={styles.upvote}
      type="button"
      aria-pressed={state.upvoted}
      aria-label={state.upvoted ? copy.removeUpvote : copy.upvotePost}
      onClick={votePost}
      disabled={busy === "post"}
    >
      <span className={styles.arrow} aria-hidden="true">
        ↑
      </span>
      <span aria-hidden="true">{state.upvoted ? copy.upvoted : copy.upvote}</span>
      <span className={styles.total}>{state.upvotes}</span>
    </button>
  );

  return (
    <section id="comments" className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId}>{copy.title}</h2>
        <span className={styles.count}>{fill(copy.shown, { n: state.comments.length })}</span>
      </div>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      {state.signedIn ? (
        <CommentCompose engagement={engagement} copy={copy} actions={postUpvote} />
      ) : (
        <div className={styles.gate}>
          <div className={styles.gateCopy}>
            <strong>{copy.gateTitle}</strong>
            <p>
              {copy.gateBefore}
              <a href={signUpHref}>{copy.gateLink}</a>
              {copy.gateAfter}
            </p>
          </div>
          <div className={styles.actions}>
            {postUpvote}
            <a className={styles.primary} href={signInHref}>
              {copy.signIn}
            </a>
          </div>
        </div>
      )}

      <CommentList engagement={engagement} copy={copy} locale={locale} />
    </section>
  );
}
