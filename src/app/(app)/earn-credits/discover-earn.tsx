"use client";

import { Gift, MessageCircle, Sparkles, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Textarea } from "@/components/ui/textarea";
import type { DiscoverItem } from "@/lib/earn/discover";
import { claimDiscoverBonusAction, discoverCommentAction, discoverDraftAction, discoverUpvoteAction } from "@/lib/earn/discover-actions";
import {
  commentProblem,
  DISCOVER_COMMENT,
  DISCOVER_GOAL,
  DISCOVER_STYLES,
  discoverGoalReached,
  isDiscoverStyle,
  type CommentProblem,
  type DiscoverProgress,
  type DiscoverStyle,
} from "@/lib/earn/discover-rules";
import type { EarnDiscoverCopy } from "@/lib/i18n/earn-discover";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import styles from "./discover-earn.module.css";

/**
 * Discover & earn on Earn Credits (client ticket, 2026-11-11,
 * repget-earn-credits-multiple-businesses.html): one customer story at a time,
 * with its upvote and its AI-assisted comment, the goal, and the queue of
 * every story. The upvotes and comments are the posts' own and show on each
 * post's page. What is counted always comes from the server's answer; only
 * "skipped" is the browser's own (it changes nothing on the server).
 */

const SKIPPED_KEY = "repget_discover_skipped_v1";
const ADVANCE_MS = 650;

/*
  The skipped stories, kept in this browser only. Read through
  useSyncExternalStore, so the first render matches the server's (nothing
  skipped) and the stored list follows; a write tells this tab and others.
*/
const SKIPPED_EVENT = "repget:discover-skipped";
let skippedFallback = "[]";

function skippedSnapshot(): string {
  try {
    return window.localStorage.getItem(SKIPPED_KEY) ?? "[]";
  } catch {
    return skippedFallback;
  }
}

function subscribeSkipped(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SKIPPED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SKIPPED_EVENT, onChange);
  };
}

function parseSkipped(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSkipped(ids: string[]) {
  const raw = JSON.stringify(ids.slice(-200));
  try {
    window.localStorage.setItem(SKIPPED_KEY, raw);
  } catch {
    // A private window: skipping still works for this visit.
    skippedFallback = raw;
  }
  window.dispatchEvent(new Event(SKIPPED_EVENT));
}

/** A blog featured image stored where next/image may resize it (next.config.ts); anything else is shown as it is. */
function isResizable(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/article-images/blog/posts/`) && !url.includes("?");
}

function Picture({ item, alt, sizes, preload = false }: { item: DiscoverItem; alt: string; sizes: string; preload?: boolean }) {
  if (item.imageUrl) {
    return isResizable(item.imageUrl) ? (
      <Image src={item.imageUrl} alt={alt} fill sizes={sizes} preload={preload} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- a stored address next/image is not allowed to fetch
      <img src={item.imageUrl} alt={alt} loading={preload ? "eager" : "lazy"} decoding="async" />
    );
  }
  return (
    <span className={styles.fallback} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      {item.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the business's logo, from any host
        <img src={item.logoUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span aria-hidden="true">{item.name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

/** Where the queue starts: the first story with something left to do. */
function firstOpen(items: DiscoverItem[]): number {
  const index = items.findIndex((item) => !item.upvoted || !item.commented);
  return index === -1 ? 0 : index;
}

/** Arrow keys belong to whatever has focus when it uses them itself. */
function ownsArrows(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return Boolean(target.closest('[role="tablist"],[role="listbox"],[role="menu"],[role="radiogroup"],[role="slider"],[role="combobox"],[role="dialog"]'));
}

export function DiscoverEarn({
  businesses,
  progress: served,
  claimed: servedClaimed,
  t,
}: {
  businesses: DiscoverItem[];
  progress: DiscoverProgress;
  claimed: boolean;
  t: EarnDiscoverCopy;
}) {
  const router = useRouter();
  const [items, setItems] = useState(businesses);
  const [progress, setProgress] = useState(served);
  const [claimed, setClaimed] = useState(servedClaimed);
  const [index, setIndex] = useState(() => firstOpen(businesses));
  const skippedRaw = useSyncExternalStore(subscribeSkipped, skippedSnapshot, () => "[]");
  const skipped = useMemo(() => parseSkipped(skippedRaw), [skippedRaw]);
  const [switching, setSwitching] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [voting, startVote] = useTransition();
  const [claiming, startClaim] = useTransition();
  const railRef = useRef<HTMLDivElement>(null);

  const total = items.length;
  const current = items[Math.min(index, total - 1)];
  const ready = discoverGoalReached(progress);
  const bonus = DISCOVER_GOAL.bonus;

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setIndex(next);
      setSwitching(true);
    },
    [total],
  );
  const goNext = useCallback(() => {
    setIndex((at) => (at + 1) % Math.max(total, 1));
    setSwitching(true);
  }, [total]);
  const goPrevious = useCallback(() => {
    setIndex((at) => Math.max(0, at - 1));
    setSwitching(true);
  }, []);

  useEffect(() => {
    if (!switching) return;
    const timer = window.setTimeout(() => setSwitching(false), 190);
    return () => window.clearTimeout(timer);
  }, [switching, index]);

  // The active tile into view inside the rail, without moving the page.
  useEffect(() => {
    const rail = railRef.current;
    const tile = rail?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!rail || !tile) return;
    // The rail is the tiles' offsetParent (position: relative), so this ignores its scroll.
    const left = tile.offsetLeft;
    if (left < rail.scrollLeft || left + tile.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rail.scrollTo({ left: Math.max(0, left - 8), behavior: reduce ? "auto" : "smooth" });
    }
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (commenting || document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      if (ownsArrows(event.target)) return;
      if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goPrevious();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commenting, goNext, goPrevious]);

  const advanceLater = useCallback(() => {
    window.setTimeout(goNext, ADVANCE_MS);
  }, [goNext]);

  function mark(postId: string, change: Partial<Pick<DiscoverItem, "upvoted" | "commented">>) {
    setItems((list) => list.map((item) => (item.postId === postId ? { ...item, ...change } : item)));
  }

  function skip() {
    if (!current) return;
    if (!skipped.includes(current.postId)) writeSkipped([...skipped, current.postId]);
    goNext();
    toast(format(t.toastSkipped, { name: current.name }));
  }

  function upvote() {
    if (!current || current.upvoted) return;
    const item = current;
    startVote(async () => {
      try {
        const result = await discoverUpvoteAction(item.postId);
        if (!result.ok) {
          toast.error(t.errors[result.error]);
          return;
        }
        mark(item.postId, { upvoted: true });
        setProgress(result.progress);
        toast.success(format(t.toastUpvoted, { name: item.name }));
        if (item.commented) advanceLater();
      } catch {
        toast.error(t.errors.failed);
      }
    });
  }

  function commented(item: DiscoverItem, next: DiscoverProgress) {
    mark(item.postId, { commented: true });
    setProgress(next);
    setCommenting(false);
    toast.success(format(t.toastCommented, { name: item.name }));
    if (item.upvoted) advanceLater();
  }

  function claim() {
    startClaim(async () => {
      try {
        const result = await claimDiscoverBonusAction();
        if (result.ok) {
          setClaimed(true);
          setProgress(result.progress);
          toast.success(format(t.toastBonus, { bonus: result.credits }));
          router.refresh();
          return;
        }
        if (result.progress) setProgress(result.progress);
        if (result.error === "already_claimed") setClaimed(true);
        toast.error(t.errors[result.error]);
      } catch {
        toast.error(t.errors.failed);
      }
    });
  }

  if (!current) return null;

  const upvotes = Math.min(progress.upvotes, DISCOVER_GOAL.upvotes);
  const comments = Math.min(progress.comments, DISCOVER_GOAL.comments);
  const last = index === total - 1;
  const note = claimed ? t.noteClaimed : ready ? t.noteReady : t.noteOpen;
  const feedback = [current.upvoted ? t.feedbackUpvoted : "", current.commented ? t.feedbackCommented : ""].filter(Boolean).join("  ");

  return (
    <section aria-label={t.sectionLabel} className={styles.card} id="discover-earn">
      <div className={styles.discover}>
        <div className={cn(styles.photo, switching && styles.switching)}>
          <Picture
            key={current.postId}
            item={current}
            alt={format(t.photoAlt, { name: current.name })}
            sizes="(min-width: 1040px) 26rem, (min-width: 620px) 45vw, 92vw"
            preload={index === firstOpen(businesses)}
          />
          <div className={styles.photoTop}>
            <span>{format(t.counter, { n: index + 1, total })}</span>
            {current.websiteUrl ? (
              <a href={current.websiteUrl} target="_blank" rel="noopener noreferrer">
                {t.visitSite} ↗
              </a>
            ) : null}
          </div>
          <div className={styles.photoBottom}>
            <strong>{current.name}</strong>
            <span>{current.tagline}</span>
          </div>
        </div>

        <div className={styles.body}>
          <p className={styles.overline}>{t.eyebrow}</p>
          <h2>{t.title}</h2>
          <p>{t.body}</p>
          {current.category ? <div className={styles.category}>{current.category}</div> : null}
          <div className={styles.buttons}>
            <Button type="button" onClick={upvote} disabled={current.upvoted || voting}>
              <ThumbsUp aria-hidden="true" />
              {current.upvoted ? t.upvoted : t.upvote}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5 hover:text-primary dark:border-primary"
              onClick={() => setCommenting(true)}
              disabled={current.commented}
            >
              <MessageCircle aria-hidden="true" />
              {current.commented ? t.commented : t.comment}
            </Button>
          </div>
          <div className={styles.links}>
            <button type="button" className={styles.skip} onClick={skip}>
              {t.skip} <span aria-hidden="true">→</span>
            </button>
            <span className={styles.feedback} aria-live="polite">
              {feedback}
            </span>
          </div>
          <div className={styles.aiNote}>
            <Sparkles aria-hidden="true" />
            {t.aiNote}
          </div>
        </div>

        <div className={styles.mission}>
          <div className={styles.banner}>
            <Gift aria-hidden="true" />
            <span>
              {format(t.missionLead, { upvotes: DISCOVER_GOAL.upvotes, comments: DISCOVER_GOAL.comments })}{" "}
              <strong>{format(t.missionReward, { bonus })}</strong>
            </span>
          </div>
          <div className={styles.taskRow}>
            <span>
              <ThumbsUp aria-hidden="true" />
              {t.upvotesLabel}
            </span>
            <b>
              {upvotes} / {DISCOVER_GOAL.upvotes}
            </b>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={t.upvotesProgress}
            aria-valuemin={0}
            aria-valuemax={DISCOVER_GOAL.upvotes}
            aria-valuenow={upvotes}
          >
            <div className={styles.fill} style={{ width: `${(upvotes / DISCOVER_GOAL.upvotes) * 100}%` }} />
          </div>
          <div className={styles.taskRow}>
            <span>
              <MessageCircle aria-hidden="true" />
              {t.commentsLabel}
            </span>
            <b>
              {comments} / {DISCOVER_GOAL.comments}
            </b>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={t.commentsProgress}
            aria-valuemin={0}
            aria-valuemax={DISCOVER_GOAL.comments}
            aria-valuenow={comments}
          >
            <div className={styles.fill} style={{ width: `${(comments / DISCOVER_GOAL.comments) * 100}%` }} />
          </div>
          <p className={cn(styles.note, claimed && styles.complete)} aria-live="polite">
            {format(note, { bonus })}
          </p>
          {ready && !claimed ? (
            <Button type="button" className={cn(styles.claim, "h-auto py-2.5")} onClick={claim} disabled={claiming}>
              <Gift aria-hidden="true" />
              {format(t.claim, { bonus })}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.queue}>
        <div className={styles.queueTop}>
          <div className={styles.caption}>
            <strong>{t.queueTitle}</strong>
            <span>{t.queueHint}</span>
          </div>
          <div className={styles.nav}>
            <span>
              {index + 1} / {total}
            </span>
            <button type="button" className={styles.arrow} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t.previous} title={t.previous}>
              ←
            </button>
            <button type="button" className={styles.next} onClick={goNext}>
              {last ? t.backToFirst : t.next} <span aria-hidden="true">{last ? "↻" : "→"}</span>
            </button>
          </div>
        </div>
        <div className={styles.rail} role="group" aria-label={t.railLabel} ref={railRef}>
          {items.map((item, at) => {
            const status = [item.upvoted ? t.tileVote : "", item.commented ? t.tileComment : ""].filter(Boolean).join(" · ");
            return (
              <button
                key={item.postId}
                type="button"
                data-index={at}
                className={cn(styles.tile, at === index && styles.active)}
                aria-label={item.category ? `${item.name}, ${item.category}` : item.name}
                aria-pressed={at === index}
                onClick={() => go(at)}
              >
                <span className={styles.thumb}>
                  <Picture item={item} alt="" sizes="46px" />
                </span>
                <span className={styles.tileInfo}>
                  <strong>{item.name}</strong>
                  {item.category ? <small>{item.category}</small> : null}
                  <em>{status || (skipped.includes(item.postId) ? t.tileSkipped : "")}</em>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {commenting ? <CommentDialog item={current} t={t} onClose={() => setCommenting(false)} onPosted={commented} /> : null}
    </section>
  );
}

type DraftState = "loading" | "ready" | "unavailable" | "limit" | "failed";

function CommentDialog({
  item,
  t,
  onClose,
  onPosted,
}: {
  item: DiscoverItem;
  t: EarnDiscoverCopy;
  onClose: () => void;
  onPosted: (item: DiscoverItem, progress: DiscoverProgress) => void;
}) {
  const [style, setStyle] = useState<DiscoverStyle>("question");
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>("loading");
  const [posting, startPost] = useTransition();
  const drafts = useRef<Partial<Record<DiscoverStyle, string>>>({});
  const request = useRef(0);
  const styleId = useId();
  const textId = useId();
  const confirmId = useId();
  const errorId = useId();
  const noteId = useId();

  const fetchDraft = useCallback(
    async (chosen: DiscoverStyle, fresh: boolean) => {
      const cached = drafts.current[chosen];
      if (cached && !fresh) {
        setText(cached);
        setDraft("ready");
        return;
      }
      const ticket = ++request.current;
      setDraft("loading");
      try {
        const result = await discoverDraftAction({ postId: item.postId, style: chosen });
        if (ticket !== request.current) return;
        if (result.ok) {
          drafts.current[chosen] = result.draft;
          setText(result.draft);
          setDraft("ready");
        } else {
          setDraft(result.reason === "unavailable" ? "unavailable" : result.reason === "limit" ? "limit" : "failed");
        }
      } catch {
        if (ticket === request.current) setDraft("failed");
      }
    },
    [item.postId],
  );

  useEffect(() => {
    void fetchDraft("question", false);
  }, [fetchDraft]);

  const problems: Record<CommentProblem, string> = {
    short: format(t.errShort, { min: DISCOVER_COMMENT.min }),
    too_long: format(t.errTooLong, { max: DISCOVER_COMMENT.max }),
    link: t.errLink,
    unconfirmed: t.errConfirm,
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = commentProblem(text, confirmed);
    if (problem) {
      setError(problems[problem]);
      return;
    }
    setError(null);
    startPost(async () => {
      try {
        const result = await discoverCommentAction({ postId: item.postId, body: text, confirmed });
        if (result.ok) {
          onPosted(item, result.progress);
          return;
        }
        setError(result.error in problems ? problems[result.error as CommentProblem] : t.errors[result.error as keyof typeof t.errors] ?? t.errors.failed);
      } catch {
        setError(t.errors.failed);
      }
    });
  }

  const note =
    draft === "loading" ? t.drafting : draft === "unavailable" ? t.draftUnavailable : draft === "limit" ? t.draftLimit : draft === "failed" ? t.draftFailed : t.draftNote;
  const canDraft = draft !== "unavailable" && draft !== "limit";

  return (
    <Dialog open onOpenChange={(open) => !open && !posting && onClose()}>
      <DialogContent className="sm:max-w-[510px]" closeLabel={t.close}>
        <form onSubmit={submit} className="grid gap-0" noValidate>
          <DialogHeader className="pr-8">
            <p className={styles.overline}>{t.dialogEyebrow}</p>
            <DialogTitle className="text-xl leading-tight font-bold tracking-tight">{format(t.dialogTitle, { name: item.name })}</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">{t.dialogBody}</DialogDescription>
          </DialogHeader>

          <Label htmlFor={styleId} className="mt-3.5 mb-1.5 text-xs font-semibold">
            {t.styleLabel}
          </Label>
          <NativeLikeSelect
            id={styleId}
            value={style}
            disabled={posting || !canDraft}
            onChange={(event) => {
              const next = isDiscoverStyle(event.target.value) ? event.target.value : "question";
              setStyle(next);
              setError(null);
              void fetchDraft(next, false);
            }}
          >
            {DISCOVER_STYLES.map((value) => (
              <option key={value} value={value}>
                {t.styles[value]}
              </option>
            ))}
          </NativeLikeSelect>

          <Label htmlFor={textId} className="mt-3.5 mb-1.5 text-xs font-semibold">
            {t.commentLabel}
          </Label>
          <Textarea
            id={textId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={DISCOVER_COMMENT.max}
            spellCheck
            autoFocus
            readOnly={draft === "loading"}
            disabled={posting}
            aria-busy={draft === "loading"}
            aria-describedby={error ? `${noteId} ${errorId}` : noteId}
            aria-invalid={error ? true : undefined}
            className="h-[150px] resize-y text-sm leading-relaxed"
          />
          <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-muted-foreground">
            <span id={noteId} aria-live="polite">
              {note}
            </span>
            <span className="shrink-0 tabular-nums">{format(t.counterChars, { count: text.length, max: DISCOVER_COMMENT.max })}</span>
          </div>

          <label htmlFor={confirmId} className="mt-3.5 flex items-start gap-2 text-[11px] leading-normal font-medium text-muted-foreground">
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={posting}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            {t.confirm}
          </label>

          {error ? (
            <p id={errorId} role="alert" className="mt-2 text-[11px] text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void fetchDraft(style, true)} disabled={posting || draft === "loading" || !canDraft}>
              {t.regenerate}
            </Button>
            <Button type="submit" disabled={posting}>
              {posting ? t.submitting : t.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
