"use client";

import { ChevronLeft, ChevronRight, Clapperboard, Loader2, Pencil, Quote, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { format } from "@/lib/i18n/format";
import { approveVideoIdea, approveVideoReview, restoreVideoIdea, skipVideoIdea, undoVideoIdea, type IdeaEdit } from "@/lib/video/actions";
import { slideCount, UNDO_SECONDS, VIDEO_PLATFORM_SPECS, type MakeVia, type VideoScript, type VideoStyle } from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

// TODO(viral-integration): VideoPublishingStatus from "@/lib/video/publish-actions" (Worker D).
import type { VideoPublishingStatus } from "./_pending";
import { EditDialog } from "./edit-dialog";
import {
  browse,
  categoryCounts,
  clampIndex,
  isPageUndo,
  overlayOpen,
  splitHashtags,
  undoTarget,
  visibleIdeas,
  type CategoryFilter,
  type FormatFilter,
  type LastAction,
} from "./logic";
import { CarouselPreview, ReelPreview } from "./preview";
import { EmptyState, errorText, type ActionResult, PlatformDots, type IdeaView, type MediaView, type Run, type T, type TrackView } from "./shared";

const CATEGORY_CHIPS: CategoryFilter[] = ["all", "viral", "educational", "authority", "promotional"];

/**
 * Today's ideas (client, 2026-11-02; viral content 2026-11-12): category
 * chips with live counts over the format filter, then the idea as a swipe
 * deck beside its details. → or a swipe right makes it, ← or a swipe left
 * skips it - unchanged; ‹ › only browse. Ctrl/Cmd+Z takes back the last make
 * (within UNDO_SECONDS) or skip, never a field's own undo.
 */
export function IdeasDeck(props: {
  websiteId: string;
  canEdit: boolean;
  ideas: IdeaView[];
  gone: Set<string>;
  setGone: React.Dispatch<React.SetStateAction<Set<string>>>;
  category: CategoryFilter;
  onCategory: (category: CategoryFilter) => void;
  filter: FormatFilter;
  onFilter: (filter: FormatFilter) => void;
  focus: boolean;
  onFocus: (on: boolean) => void;
  writing: boolean;
  complete: boolean;
  goal: number;
  priceLabel: string;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  media: MediaView[];
  tracks: TrackView[];
  run: Run;
  pending: boolean;
  t: T;
}) {
  const { t, websiteId, gone, setGone, focus, onFocus } = props;
  const v = t.viral;
  const router = useRouter();
  const [lastSkipped, setLastSkipped] = useState<string | null>(null);
  const [last, setLast] = useState<LastAction | null>(null);
  const [editing, setEditing] = useState<IdeaView | null>(null);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  // The card with the preview, and whether the last press was on it: arrows then scroll its slides.
  const card = useRef<HTMLDivElement | null>(null);
  const pressedCard = useRef(false);

  const deck = visibleIdeas(props.ideas, gone, props.category, props.filter);
  const counts = categoryCounts(props.ideas, gone, props.filter);
  const at = clampIndex(index, deck.length);
  const current = deck[at];

  const back = useCallback(
    (id: string) => {
      setGone((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    },
    [setGone],
  );

  const settle = useCallback(
    async (idea: IdeaView, action: Promise<ActionResult>, success?: string, onUndo?: () => void) => {
      setGone((set) => new Set(set).add(idea.id));
      const result = await action.catch(() => null);
      if (!result || !result.ok) {
        back(idea.id);
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return false;
      }
      if (success) {
        toast.success(success, onUndo ? { duration: UNDO_SECONDS * 1000, action: { label: t.undo, onClick: onUndo } } : undefined);
      }
      router.refresh();
      return true;
    },
    [router, t, props.priceLabel, back, setGone],
  );

  // A make by mistake: taken back within UNDO_SECONDS, the credit returned.
  const undoMake = useCallback(
    async (id: string) => {
      setLast(null);
      const result = await undoVideoIdea(websiteId, id).catch(() => null);
      if (!result || !result.ok) {
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return;
      }
      back(id);
      toast.success(t.undone);
      router.refresh();
    },
    [websiteId, t, props.priceLabel, back, router],
  );

  const restoreSkip = useCallback(
    (id: string) => {
      setLastSkipped(null);
      setLast(null);
      back(id);
      props.run(() => restoreVideoIdea(websiteId, id), v.undoSkip);
    },
    [back, props, websiteId, v.undoSkip],
  );

  const approve = useCallback(
    (idea: IdeaView, edit: IdeaEdit = {}, via: MakeVia = "button") => {
      setLastSkipped(null);
      setLast({ kind: "make", id: idea.id, at: Date.now() });
      void settle(idea, approveVideoIdea(websiteId, idea.id, edit, via), t.approved, () => void undoMake(idea.id));
    },
    [settle, websiteId, t.approved, undoMake],
  );
  const skip = useCallback(
    (idea: IdeaView) => {
      setLastSkipped(idea.id);
      setLast({ kind: "skip", id: idea.id, at: Date.now() });
      void settle(idea, skipVideoIdea(websiteId, idea.id));
    },
    [settle, websiteId],
  );

  // → makes, ← skips (unchanged since 2026-11-02): not with a modifier, a held key, in a field or button, or after a press on the preview.
  useEffect(() => {
    if (!current || !props.canEdit || editing) return;
    const onPress = (event: PointerEvent) => {
      pressedCard.current = Boolean(card.current?.contains(event.target as Node));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [role=slider], [role=combobox], [contenteditable=true]")) return;
      if (pressedCard.current) return;
      if (event.key === "ArrowRight") approve(current, {}, "key");
      if (event.key === "ArrowLeft") skip(current);
    };
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [current, props.canEdit, editing, approve, skip]);

  // Ctrl/Cmd+Z: the last make (inside its 10 s) or the last skip - never inside a field, and not while a dialog or menu is open.
  useEffect(() => {
    if (!props.canEdit || editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isPageUndo(event, overlayOpen(document))) return;
      const target = undoTarget(last, Date.now(), UNDO_SECONDS);
      if (!target) return;
      event.preventDefault();
      if (target.kind === "make") void undoMake(target.id);
      else restoreSkip(target.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.canEdit, editing, last, undoMake, restoreSkip]);

  // Esc leaves focus mode - not while the edit dialog is open (Esc closes that first).
  useEffect(() => {
    if (!focus || editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, editing, onFocus]);

  const chips = (
    <CategoryChips
      counts={counts}
      category={props.category}
      onCategory={(next) => {
        props.onCategory(next);
        setIndex(0);
      }}
      t={t}
    />
  );

  if (props.writing && props.ideas.length === 0) {
    return <EmptyState icon={<Loader2 className="size-6 animate-spin" aria-hidden="true" />} title={t.writingIdeas} body={t.writingIdeasBody} />;
  }
  if (!current) {
    // Ideas left under other filters: the filters hide them, they are not used up.
    const others = props.ideas.filter((idea) => !gone.has(idea.id)).length;
    return others > 0 ? (
      <div className="space-y-4">
        {focus ? null : chips}
        <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={v.filters.empty} body={v.filters.emptyBody}>
          <Button
            variant="outline"
            onClick={() => {
              props.onCategory("all");
              props.onFilter("all");
              setIndex(0);
            }}
          >
            {v.filters.clear}
          </Button>
        </EmptyState>
      </div>
    ) : (
      <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noIdeasLeft} body={t.noIdeasLeftBody} />
    );
  }

  const swipeEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    if (drag > 120) approve(current, {}, "swipe");
    else if (drag < -120) skip(current);
    setDrag(0);
  };
  const kind =
    current.format === "carousel"
      ? format(t.detail.carouselSlides, { count: String(slideCount(current.props.script)) })
      : current.format === "story"
        ? v.formats.story
        : t.reel;
  // The animated templates are what the preview really plays; the new directions are made from footage, voice and music later.
  const previewNote = current.direction === "animated" ? t.previewNote : v.previewConcept;

  return (
    <div className="space-y-4">
      {focus ? null : chips}
      <div className={focus ? "mx-auto w-full max-w-2xl" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}>
        <section aria-label={current.title} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span className="uppercase tracking-wide" aria-live="polite">
              {format(t.ideaOf, { index: String(at + 1), count: String(deck.length) })}
            </span>
            <div className="flex items-center gap-1">
              {focus ? <Badge variant="secondary">{kind}</Badge> : null}
              <Button
                variant="outline"
                size="icon"
                aria-label={v.browse.previous}
                title={v.browse.previous}
                disabled={deck.length < 2}
                onClick={() => setIndex(browse(at, -1, deck.length))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={v.browse.next}
                title={v.browse.next}
                disabled={deck.length < 2}
                onClick={() => setIndex(browse(at, 1, deck.length))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          {focus ? <h2 className="text-center text-xl font-semibold leading-tight">{current.title}</h2> : null}

          <div className={`mx-auto w-full ${focus ? "max-w-[420px]" : "max-w-[340px]"}`}>
            <div
              ref={card}
              className="relative touch-pan-y select-none"
              style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)`, transition: dragging ? "none" : "transform 200ms ease" }}
              onPointerDown={(event) => {
                // Only a finger swipes: a mouse drag (a carousel's scroll bar) or sliding through its slides never makes a video.
                if (!props.canEdit || event.pointerType !== "touch") return;
                const target = event.target as HTMLElement;
                if (target.closest("button, input, [role=slider]") || scrollsSideways(target, event.currentTarget)) return;
                startX.current = event.clientX;
                setDragging(true);
              }}
              onPointerMove={(event) => {
                if (startX.current !== null) setDrag(event.clientX - startX.current);
              }}
              onPointerUp={swipeEnd}
              onPointerCancel={() => {
                startX.current = null;
                setDragging(false);
                setDrag(0);
              }}
            >
              {drag !== 0 ? (
                <div
                  className={`pointer-events-none absolute top-4 z-10 rounded-lg border-4 px-3 py-1 text-xl font-black uppercase ${drag > 0 ? "left-4 rotate-[-12deg] border-emerald-500 text-emerald-500" : "right-4 rotate-[12deg] border-rose-500 text-rose-500"}`}
                  style={{ opacity: Math.min(1, Math.abs(drag) / 120) }}
                >
                  {drag > 0 ? "✓" : "✕"}
                </div>
              ) : null}
              {current.format === "carousel" ? (
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <CarouselPreview props={current.props} />
                </div>
              ) : (
                <ReelPreview key={current.id} props={current.props} />
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">{previewNote}</p>
          </div>

          {props.complete ? <Notice tone="success" title={t.dayComplete}>{format(t.dayCompleteBody, { goal: String(props.goal) })}</Notice> : null}

          {props.canEdit ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="lg" onClick={() => skip(current)}>
                  <X aria-hidden="true" />
                  {t.skip}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setEditing(current)}>
                  <Pencil aria-hidden="true" />
                  {t.edit}
                </Button>
                <Button size="lg" className="px-4" onClick={() => approve(current)}>
                  <Sparkles aria-hidden="true" />
                  {format(t.approve, { price: props.priceLabel })}
                </Button>
                {lastSkipped ? (
                  <Button variant="ghost" size="lg" onClick={() => restoreSkip(lastSkipped)}>
                    <Undo2 aria-hidden="true" />
                    {t.undo}
                  </Button>
                ) : null}
              </div>
              <p className="text-center text-xs text-muted-foreground">{t.swipeHint}</p>
              <p className="text-center text-xs text-muted-foreground">{v.browse.hint}</p>
            </div>
          ) : null}
          {focus ? <p className="text-center text-xs text-muted-foreground">{t.focus.hint}</p> : null}
        </section>

        {focus ? null : <IdeaDetail key={current.id} idea={current} kind={kind} websiteId={websiteId} canEdit={props.canEdit} run={props.run} pending={props.pending} settings={props.settings} t={t} />}

        {editing ? (
          <EditDialog
            idea={editing}
            websiteId={websiteId}
            media={props.media}
            tracks={props.tracks}
            settings={props.settings}
            xAvailable={props.publishing.x.available}
            priceLabel={props.priceLabel}
            onClose={() => setEditing(null)}
            onApprove={(edit) => {
              const idea = editing;
              setEditing(null);
              approve(idea, edit);
            }}
            run={props.run}
            pending={props.pending}
            t={t}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The category chips (client's mockup): a live count each, aria-pressed, scrolling sideways on a phone. */
function CategoryChips({ counts, category, onCategory, t }: { counts: Record<CategoryFilter, number>; category: CategoryFilter; onCategory: (category: CategoryFilter) => void; t: T }) {
  const v = t.viral;
  const helpId = useId();
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label={v.filters.label} aria-describedby={helpId} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {CATEGORY_CHIPS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => onCategory(key)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
              category === key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {key === "viral" ? <span aria-hidden="true" className={`size-1.5 rounded-full ${category === key ? "bg-primary-foreground" : "bg-primary"}`} /> : null}
            {v.categories[key]}
            <span className={`text-xs tabular-nums ${category === key ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>
      <p id={helpId} className="text-xs text-muted-foreground">
        {v.categoryHelp[category]}
      </p>
    </div>
  );
}

/** The panel beside the preview (client's mockup): the badges, hook, concept, why, post text, review and where it goes. */
function IdeaDetail({
  idea,
  kind,
  websiteId,
  canEdit,
  run,
  pending,
  settings,
  t,
}: {
  idea: IdeaView;
  kind: string;
  websiteId: string;
  canEdit: boolean;
  run: Run;
  pending: boolean;
  settings: VideoSettings;
  t: T;
}) {
  const v = t.viral;
  const [open, setOpen] = useState(false);
  const captionId = useId();
  const script = idea.props.script;
  const { text, hashtags } = splitHashtags(idea.caption);
  // Short texts are shown whole; only a long one folds.
  const long = text.length > 240 || text.split("\n").length > 5;
  const carousel = idea.format === "carousel";
  const story = idea.format === "story";
  // Pinterest, LinkedIn and X only when chosen in Settings, and only where the format can go.
  const platforms = settings.platforms.filter((platform) => {
    const spec = VIDEO_PLATFORM_SPECS[platform];
    return carousel ? spec.carousel : story ? spec.story : true;
  });
  const viral = idea.category === "viral";

  return (
    <aside aria-label={t.detail.eyebrow} className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.detail.eyebrow}</span>
        <div className="flex flex-wrap gap-1.5">
          {viral ? <Badge className="bg-primary/10 text-primary">{v.viralBadge}</Badge> : <Badge variant="outline">{v.categories[idea.category]}</Badge>}
          <Badge variant="secondary">{kind}</Badge>
          <Badge variant="outline">{v.directions[idea.direction]}</Badge>
          {idea.format !== "carousel" ? <Badge variant="outline">{v.audio[idea.production.audio]}</Badge> : null}
          {idea.direction === "animated" ? <Badge variant="outline">{t.styles[idea.style as VideoStyle] ?? idea.style}</Badge> : null}
        </div>
      </div>
      <h2 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{idea.title}</h2>

      {idea.production.showHook ? (
        <div className="rounded-xl border bg-muted/40 p-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Quote className="size-3" aria-hidden="true" />
            {t.detail.hook}
          </p>
          <p className="text-sm">{script.hook}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.detail.concept}</h3>
        <ScriptSummary script={script} includeCta={idea.production.includeCta} ctaText={idea.production.ctaText} t={t} />
      </div>

      {viral && (idea.why || idea.techniques.length > 0) ? (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <h3 className="text-sm font-semibold">{v.why.title}</h3>
          {idea.why ? <p className="text-sm text-muted-foreground">{idea.why}</p> : null}
          {idea.techniques.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {idea.techniques.map((tag) => (
                <li key={tag} className="rounded-full border bg-background px-2 py-0.5 text-xs">
                  {v.techniques[tag as keyof T["viral"]["techniques"]] ?? tag}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">{v.why.note}</p>
        </div>
      ) : null}

      <ReviewBox idea={idea} websiteId={websiteId} canEdit={canEdit} run={run} pending={pending} t={t} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.caption}</h3>
        <p id={captionId} className={`text-sm whitespace-pre-line text-muted-foreground ${long && !open ? "line-clamp-4" : ""}`}>
          {text}
        </p>
        {hashtags ? <p className="text-sm break-words text-primary">{hashtags}</p> : null}
        {long ? (
          <button type="button" aria-expanded={open} aria-controls={captionId} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(!open)}>
            {open ? t.detail.captionLess : t.detail.captionMore}
          </button>
        ) : null}
      </div>

      <div className="mt-auto border-t pt-4">
        <p className="mb-2 text-xs text-muted-foreground">{t.detail.readyFor}</p>
        {platforms.length > 0 ? <PlatformDots platforms={platforms} /> : <p className="text-xs text-muted-foreground">{t.detail.noPlatforms}</p>}
      </div>
    </aside>
  );
}

/**
 * An idea a person should check (figures not found in the website's
 * material, a controversial or sensitive angle): what to check, and "I
 * checked this". It only holds back automatic posting.
 */
function ReviewBox({ idea, websiteId, canEdit, run, pending, t }: { idea: IdeaView; websiteId: string; canEdit: boolean; run: Run; pending: boolean; t: T }) {
  const r = t.viral.review;
  if (idea.reviewStatus === "approved" && !idea.reviewBlocks) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        {r.checked}
      </p>
    );
  }
  if (!idea.reviewBlocks) return null;
  const reasons = idea.reviewReasons.map((reason) => r.reasons[reason as keyof T["viral"]["review"]["reasons"]] ?? reason);
  const unsourced = idea.claims.filter((claim) => !claim.source);
  return (
    <Notice tone="warning" title={format(r.title, { reasons: reasons.join(", ") || r.reasons.unverified_claim })}>
      <div className="space-y-2">
        {unsourced.length > 0 ? (
          <>
            <p>{r.what}</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {unsourced.map((claim) => (
                <li key={claim.text}>{claim.text}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="text-xs">{r.note}</p>
        {canEdit ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => approveVideoReview(websiteId, idea.id), r.done)}>
            <ShieldCheck aria-hidden="true" />
            {r.approve}
          </Button>
        ) : null}
      </div>
    </Notice>
  );
}

function ScriptSummary({ script, includeCta, ctaText, t }: { script: VideoScript; includeCta: boolean; ctaText: string | null; t: T }) {
  return (
    <ol className="space-y-2 text-sm">
      {script.points.map((point, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
          <span>
            <span className="font-medium">{point.title}</span>
            <span className="text-muted-foreground"> — {point.detail}</span>
          </span>
        </li>
      ))}
      {script.proof ? (
        <li className="text-muted-foreground">
          {t.proof}: {script.proof}
        </li>
      ) : null}
      <li className="text-muted-foreground">
        {t.cta}: {includeCta ? ctaText || script.cta : t.viral.noCta}
      </li>
    </ol>
  );
}

/** Whether a press is on something that scrolls sideways (a carousel's slides): dragging it scrolls, it is no swipe. */
function scrollsSideways(target: HTMLElement, stop: HTMLElement): boolean {
  for (let el: HTMLElement | null = target; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
