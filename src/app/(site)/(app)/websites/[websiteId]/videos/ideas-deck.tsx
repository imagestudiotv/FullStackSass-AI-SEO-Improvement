"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Loader2, Pencil, Quote, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Notice } from "@/components/workspace/notice";
import { format } from "@/lib/i18n/format";
import { approveVideoIdea, approveVideoReview, restoreVideoIdea, skipVideoIdea, undoVideoIdea, type IdeaEdit } from "@/lib/video/actions";
import { endsOnClip, slideCount, UNDO_SECONDS, VIDEO_PLATFORM_SPECS, type IdeaCategory, type MakeVia, type ShotPlan, type VideoScript, type VideoStyle } from "@/lib/video/formats";
import type { VideoPublishingStatus } from "@/lib/video/publish-actions";
import type { VideoSettings } from "@/lib/video/settings";

import { EditDialog } from "./edit-dialog";
import {
  browse,
  browseKey,
  categoryCounts,
  clampIndex,
  isPageUndo,
  overlayOpen,
  splitHashtags,
  undoTarget,
  visibleIdeas,
  type CategoryFilter,
  type LastAction,
} from "./logic";
import { CarouselPreview, ReelPreview } from "./preview";
import { EmptyState, errorText, type ActionResult, PlatformDots, selectClass, type IdeaView, type MediaView, type Run, type T, type TrackView } from "./shared";

const CATEGORIES: CategoryFilter[] = ["all", "viral", "educational", "authority", "promotional"];

/** The tag over the preview, coloured by category (the client's mockup: orange, blue, purple, grey). */
const TAG_CLASS: Record<IdeaCategory, string> = {
  viral: "bg-primary/10 text-primary",
  educational: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  authority: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  promotional: "bg-muted text-muted-foreground",
};

/**
 * Today's ideas (client, 2026-11-21, the mockup
 * repget-social-content-with-video-editor.html): the day's ideas offered
 * directly, one at a time - a big preview with ‹ › (and ← →) to browse,
 * "Idea x of N", a content-type filter, and three actions: Skip (a toast
 * with Undo), Edit (the editor) and Approve, which makes the video (its
 * credit) and opens the publishing window at once. Ctrl/Cmd+Z takes back the
 * last make (within UNDO_SECONDS) or skip. The idea's details fold out below.
 */
export function IdeasDeck(props: {
  websiteId: string;
  canEdit: boolean;
  ideas: IdeaView[];
  gone: Set<string>;
  setGone: React.Dispatch<React.SetStateAction<Set<string>>>;
  category: CategoryFilter;
  onCategory: (category: CategoryFilter) => void;
  writing: boolean;
  ideasFailed: boolean;
  complete: boolean;
  goal: number;
  priceLabel: string;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  media: MediaView[];
  tracks: TrackView[];
  run: Run;
  pending: boolean;
  /** Approve opens the publishing window for it straight away. */
  onApproved: (idea: IdeaView) => void;
  /** A make taken back (Undo) or refused: its publishing window closes. */
  onUndone: (id: string) => void;
  t: T;
}) {
  const { t, websiteId, gone, setGone, onApproved, onUndone } = props;
  const v = t.viral;
  const d = t.flow.deck;
  const router = useRouter();
  const filterId = useId();
  const [last, setLast] = useState<LastAction | null>(null);
  const [editing, setEditing] = useState<IdeaView | null>(null);
  const [index, setIndex] = useState(0);
  // The idea brought back by Undo stays on screen by its id: the refresh that follows may list the ideas in another order.
  const [focus, setFocus] = useState<string | null>(null);
  const [details, setDetails] = useState(false);

  const deck = visibleIdeas(props.ideas, gone, props.category, "all");
  const counts = categoryCounts(props.ideas, gone, "all");
  const focused = focus === null ? -1 : deck.findIndex((idea) => idea.id === focus);
  const at = focused >= 0 ? focused : clampIndex(index, deck.length);
  /** Shows the idea at `position`, letting go of an Undo's focus (browsing, filtering). */
  const show = useCallback((position: number) => {
    setFocus(null);
    setIndex(position);
  }, []);
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

  // A make by mistake: taken back within UNDO_SECONDS, the credit returned, its window closed.
  const undoMake = useCallback(
    async (id: string) => {
      setLast(null);
      const result = await undoVideoIdea(websiteId, id).catch(() => null);
      if (!result || !result.ok) {
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return;
      }
      onUndone(id);
      back(id);
      setFocus(id);
      toast.success(t.undone);
      router.refresh();
    },
    [websiteId, t, props.priceLabel, back, router, onUndone],
  );

  // A skip taken back: the idea is back in the deck, shown again.
  const restoreSkip = useCallback(
    (id: string) => {
      setLast(null);
      back(id);
      const without = new Set(gone);
      without.delete(id);
      setIndex(Math.max(0, visibleIdeas(props.ideas, without, props.category, "all").findIndex((idea) => idea.id === id)));
      setFocus(id);
      props.run(() => restoreVideoIdea(websiteId, id), v.undoSkip);
    },
    [back, gone, props, websiteId, v.undoSkip],
  );

  const approve = useCallback(
    (idea: IdeaView, edit: IdeaEdit = {}, via: MakeVia = "button") => {
      setLast({ kind: "make", id: idea.id, at: Date.now() });
      // The publishing window opens at once; it shows the video being made, and closes if the make is refused.
      onApproved(idea);
      void settle(idea, approveVideoIdea(websiteId, idea.id, edit, via), t.approved, () => void undoMake(idea.id)).then((ok) => {
        if (!ok) onUndone(idea.id);
      });
    },
    [settle, websiteId, t.approved, undoMake, onApproved, onUndone],
  );
  const skip = useCallback(
    (idea: IdeaView) => {
      setLast({ kind: "skip", id: idea.id, at: Date.now() });
      void settle(idea, skipVideoIdea(websiteId, idea.id), d.skipped, () => restoreSkip(idea.id));
    },
    [settle, websiteId, d.skipped, restoreSkip],
  );

  // ← → browse (never make or skip): not with a modifier, a held key, in a field or button, or under a dialog.
  useEffect(() => {
    if (deck.length < 2 || editing) return;
    const onKey = (event: KeyboardEvent) => {
      const step = browseKey(event, overlayOpen(document));
      if (step === null) return;
      event.preventDefault();
      show(browse(at, step, deck.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length, editing, at, show]);

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

  if (props.writing && props.ideas.length === 0) {
    return <EmptyState icon={<Loader2 className="size-6 animate-spin" aria-hidden="true" />} title={t.writingIdeas} body={t.writingIdeasBody} />;
  }
  if (props.ideasFailed && props.ideas.length === 0) {
    return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.ideasFailed} body={t.ideasFailedBody} />;
  }

  const filter = (
    <NativeLikeSelect
      id={filterId}
      aria-label={v.filters.label}
      className={`${selectClass} w-48`}
      value={props.category}
      onChange={(event) => {
        props.onCategory(event.target.value as CategoryFilter);
        show(0);
      }}
    >
      {CATEGORIES.map((key) => (
        <option key={key} value={key}>
          {key === "all" ? d.filterAll : v.categories[key]} ({counts[key]})
        </option>
      ))}
    </NativeLikeSelect>
  );

  if (!current) {
    // Ideas left under another content type: the filter hides them, they are not used up.
    const others = props.ideas.filter((idea) => !gone.has(idea.id)).length;
    return others > 0 ? (
      <div className="space-y-4">
        <div className="flex justify-end">{filter}</div>
        <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={v.filters.empty} body={v.filters.emptyBody}>
          <Button
            variant="outline"
            onClick={() => {
              props.onCategory("all");
              show(0);
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

  const kind =
    current.format === "carousel"
      ? format(t.detail.carouselSlides, { count: String(slideCount(current.props.script)) })
      : current.format === "story"
        ? v.formats.story
        : t.reel;
  // The animated templates are what the preview really plays; the new directions are made from footage, voice and music later.
  const previewNote = current.direction === "animated" ? t.previewNote : v.previewConcept;
  const arrow =
    "absolute top-[45%] z-10 flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:bg-primary/10 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40 sm:size-11";

  return (
    <div className="space-y-4">
      <div className="mx-auto flex w-full max-w-[730px] flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${TAG_CLASS[current.category]}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {d.tags[current.category]}
          </span>
          <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {format(t.ideaOf, { index: String(at + 1), count: String(deck.length) })}
          </span>
        </div>
        {filter}
      </div>

      <section aria-label={current.title} className="flex flex-col items-center">
        <div className="relative isolate mx-auto w-[min(300px,68vw)]">
          {/* Two cards behind the preview: more ideas wait in the deck. */}
          {deck.length > 1 ? (
            <>
              <div aria-hidden="true" className="absolute inset-x-0 top-1.5 -bottom-0.5 -z-10 translate-x-4 rotate-[4.5deg] rounded-3xl bg-gradient-to-br from-zinc-700 via-stone-400 to-zinc-700 opacity-60 shadow-md" />
              <div aria-hidden="true" className="absolute inset-x-0 top-1.5 -bottom-0.5 -z-10 -translate-x-4 -rotate-[4deg] rounded-3xl bg-gradient-to-br from-slate-700 via-slate-400 to-slate-800 opacity-60 shadow-md" />
            </>
          ) : null}
          <button type="button" className={`${arrow} -left-11 sm:-left-16`} aria-label={v.browse.previous} title={v.browse.previous} disabled={deck.length < 2} onClick={() => show(browse(at, -1, deck.length))}>
            <ChevronLeft className="size-4 sm:size-5" aria-hidden="true" />
          </button>
          <div className="overflow-hidden rounded-3xl bg-card shadow-lg">
            {current.format === "carousel" ? (
              <div className="bg-muted/30 p-3">
                <CarouselPreview props={current.props} />
              </div>
            ) : (
              <ReelPreview key={current.id} props={current.props} />
            )}
          </div>
          <button type="button" className={`${arrow} -right-11 sm:-right-16`} aria-label={v.browse.next} title={v.browse.next} disabled={deck.length < 2} onClick={() => show(browse(at, 1, deck.length))}>
            <ChevronRight className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {kind} · {previewNote}
        </p>

        <h2 className="mt-4 max-w-lg text-center text-base leading-snug font-semibold tracking-tight sm:text-lg">{current.title}</h2>
        {current.production.showHook ? <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">{current.props.script.hook}</p> : null}

        {props.canEdit ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              aria-label={d.skipLabel}
              title={d.skipLabel}
              onClick={() => skip(current)}
              className="flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-5 text-rose-500" aria-hidden="true" />
            </button>
            <Button variant="outline" size="lg" className="h-11 rounded-full px-5" onClick={() => setEditing(current)}>
              <Pencil aria-hidden="true" />
              {t.edit}
            </Button>
            <Button size="lg" className="h-11 rounded-full px-6 shadow-md shadow-primary/20" onClick={() => approve(current)}>
              <Check aria-hidden="true" />
              {format(d.approve, { price: props.priceLabel })}
            </Button>
          </div>
        ) : null}
        <p className="mt-3 text-center text-xs text-muted-foreground">{d.hint}</p>
        {props.complete ? (
          <div className="mt-4 w-full max-w-xl">
            <Notice tone="success" title={t.dayComplete}>
              {format(t.dayCompleteBody, { goal: String(props.goal) })}
            </Notice>
          </div>
        ) : null}

        <Button variant="ghost" size="sm" className="mt-3" aria-expanded={details} onClick={() => setDetails(!details)}>
          {details ? d.hideDetails : d.showDetails}
          <ChevronDown className={`transition ${details ? "rotate-180" : ""}`} aria-hidden="true" />
        </Button>
        {details ? (
          <div className="mt-2 w-full max-w-2xl">
            <IdeaDetail key={current.id} idea={current} kind={kind} websiteId={websiteId} canEdit={props.canEdit} run={props.run} pending={props.pending} settings={props.settings} t={t} />
          </div>
        ) : null}
      </section>

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
        <ScriptSummary script={script} includeCta={idea.production.includeCta && !endsOnClip("plan" in idea.props ? (idea.props.plan as ShotPlan | null) : null)} ctaText={idea.production.ctaText} t={t} />
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

