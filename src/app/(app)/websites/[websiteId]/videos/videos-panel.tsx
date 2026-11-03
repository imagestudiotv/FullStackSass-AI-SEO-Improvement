"use client";

import { NativeLikeSelect } from "@/components/ui/native-like-select";
import {
  Check,
  Clapperboard,
  Coins,
  Download,
  ExternalLink,
  Eye,
  Focus,
  Lightbulb,
  Loader2,
  PanelRight,
  Pencil,
  Quote,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber, plural } from "@/lib/i18n/format";
import type { VideosCopy } from "@/lib/i18n/videos";
import {
  addMediaToIdea,
  addVideoMedia,
  approveVideoIdea,
  connectVideoPlatform,
  disconnectVideoPlatform,
  editVideoIdea,
  prepareVideoUpload,
  publishVideoIdea,
  removeMediaFromIdea,
  removeVideoMedia,
  requestVideoIdeas,
  restoreVideoIdea,
  resumeVideoPlatform,
  saveVideoSettingsAction,
  skipVideoIdea,
  undoVideoIdea,
  unscheduleVideoIdea,
  type IdeaEdit,
  type VideoError,
  type VideoResult,
} from "@/lib/video/actions";
import {
  isVideoPlatform,
  REEL,
  slideCount,
  UNDO_SECONDS,
  VIDEO_PLATFORM_SPECS,
  VIDEO_PLATFORMS,
  VIDEO_STYLES,
  VOICES,
  type BrandLook,
  type MakeVia,
  type ReelProps,
  type VideoPlatform,
  type VideoScript,
  type VideoStyle,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

import { CarouselPreview, reelFrames, ReelPreview } from "./preview";

type T = VideosCopy;
type Tab = "ideas" | "videos" | "posted" | "settings";
type FormatFilter = "all" | "reel" | "carousel";

export type IdeaView = {
  id: string;
  format: string;
  style: string;
  title: string;
  caption: string;
  status: string;
  voice: string | null;
  musicTrack: string | null;
  captions: boolean;
  props: ReelProps;
  videoUrl: string | null;
  slideUrls: string[];
  platforms: VideoPlatform[];
  scheduledFor: string | null;
  postedAt: string | null;
  postedUrls: Record<string, string>;
  stats: Record<string, { views: number; likes: number; comments: number; shares: number }>;
  statsAt: string | null;
  views: number;
  error: string | null;
};

export type VideoAccountView = {
  platform: string;
  username: string;
  connected: boolean;
  pausedReason: string | null;
  /** Pinterest's board (social_accounts.target, chosen on Opportunities); null for the others. */
  board: string | null;
};
type MediaView = { id: string; url: string; kind: "image" | "video"; name: string | null };
type TrackView = { id: string; title: string; mood: string };

const platformName = (platform: string) => (isVideoPlatform(platform) ? VIDEO_PLATFORM_SPECS[platform].name : platform);
/** Where Pinterest's board is chosen: Opportunities, the social page. */
const opportunitiesHref = (websiteId: string) => `/websites/${websiteId}/social`;

function errorText(t: T, result: Extract<VideoResult<unknown>, { ok: false }>, price: string): string {
  const key: VideoError = result.error;
  if (key === "not_enough_credits") return format(t.errors.not_enough_credits, { price, available: String(result.available ?? 0) });
  return t.errors[key] ?? t.errors.generic;
}

/**
 * A video's stored error in the reader's language: the codes publishing
 * leaves (no_accounts, no_board: lib/video/publish.ts) translated, a
 * platform's own refusal as it came.
 */
function errorNote(t: T, error: string): string {
  return error
    .split(" · ")
    .map((part) => (part in t.errors ? t.errors[part as keyof T["errors"]] : part))
    .join(" · ");
}
const isCode = (t: T, error: string | null) => Boolean(error && error.split(" · ").some((part) => part in t.errors));

/** The dropdowns here sit beside h-9 buttons. */
const selectClass = "data-[size=default]:h-9";

/*
  Focus mode, remembered in this browser (client, 2026-11-02). Read through
  useSyncExternalStore: the server renders it off, and the browser's value
  arrives without a mismatch. A browser that refuses storage (a private
  window) still toggles, for the visit.
*/
const FOCUS_KEY = "repget.videos.focus";
const focusListeners = new Set<() => void>();
let focusFallback = false;
function readFocus(): boolean {
  try {
    return window.localStorage.getItem(FOCUS_KEY) === "1";
  } catch {
    return focusFallback;
  }
}
function writeFocus(on: boolean) {
  focusFallback = on;
  try {
    if (on) window.localStorage.setItem(FOCUS_KEY, "1");
    else window.localStorage.removeItem(FOCUS_KEY);
  } catch {
    // Kept in memory instead.
  }
  focusListeners.forEach((listener) => listener());
}
function useFocusMode(): [boolean, (on: boolean) => void] {
  const focus = useSyncExternalStore(
    (listener) => {
      focusListeners.add(listener);
      return () => focusListeners.delete(listener);
    },
    readFocus,
    () => false,
  );
  return [focus, writeFocus];
}

/**
 * The Social Content page (client, 2026-10-29; redesigned from the client's
 * mockup, 2026-11-02). A strip of three real numbers - ideas ready, made
 * today against the day's goal, the credits available - then four tabs:
 *  - Today's ideas: twenty ideas as a swipe deck, each previewed with the
 *    real template, beside a panel with the hook, the points and the post
 *    text - right (or →) makes it, left (or ←) skips it. A format filter,
 *    and Focus mode (the preview and Create alone; Esc leaves it). After
 *    three the day shows complete; more can still be made, each a credit.
 *  - Your videos: cards to search and filter, each with Preview, Download
 *    and Publish (now, at the best time, or at a chosen time).
 *  - Posted: where each video is, and its numbers.
 *  - Settings: four cards - the accounts, the style, publishing, the brand's
 *    logo, pictures and clips.
 */
export function VideosPanel(props: {
  websiteId: string;
  canEdit: boolean;
  level: "paid" | "trial" | "none";
  bundle: boolean;
  initialTab: Tab;
  ideas: IdeaView[];
  made: IdeaView[];
  posted: IdeaView[];
  writing: boolean;
  approvedToday: number;
  goal: number;
  perDay: number;
  /** Today's ideas however they were used (made, skipped or waiting): the day is full at perDay. */
  writtenToday: number;
  priceLabel: string;
  /** The workspace's balance, for its owner only (null for a guest, or when it could not be read). */
  credits: { available: number; label: string } | null;
  settings: VideoSettings;
  brand: BrandLook;
  media: MediaView[];
  accounts: VideoAccountView[];
  tracks: TrackView[];
  notice: { kind: "connected" | "not_connected" | "connect_failed"; platform: string | null } | null;
  refreshSeconds: number;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const [pending, start] = useTransition();
  // Ideas handled on this screen leave the deck (and the count) at once; the server agrees a moment later.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FormatFilter>("all");
  const [focus, setFocus] = useFocusMode();

  const run = useCallback(
    (action: () => Promise<VideoResult<unknown>>, success?: string, after?: () => void) => {
      start(async () => {
        const result = await action().catch(() => null);
        if (!result) return void toast.error(t.errors.generic);
        if (!result.ok) return void toast.error(errorText(t, result, props.priceLabel));
        if (success) toast.success(success);
        after?.();
        router.refresh();
      });
    },
    [router, t, props.priceLabel],
  );

  // While something is being written, made or published, the page looks again every few seconds.
  const busy = props.writing || props.made.some((idea) => ["approved", "making", "posting"].includes(idea.status));
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), props.refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [busy, router, props.refreshSeconds]);

  function selectTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.searchParams.delete("social");
    url.searchParams.delete("platform");
    window.history.replaceState(null, "", url.toString());
  }

  const complete = props.approvedToday >= props.goal;
  const noticePlatform = props.notice?.platform ? platformName(props.notice.platform) : "";
  const ready = props.ideas.filter((idea) => !gone.has(idea.id)).length;
  const counts: Record<Tab, number> = { ideas: ready, videos: props.made.length, posted: props.posted.length, settings: 0 };
  const editable = props.canEdit && props.level !== "none";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          <>
            {editable ? (
              <Button
                variant="outline"
                disabled={pending || props.writtenToday >= props.perDay}
                title={props.writtenToday >= props.perDay ? t.dayFull : undefined}
                onClick={() => run(() => requestVideoIdeas(websiteId), t.ideasQueued)}
              >
                <RefreshCw aria-hidden="true" />
                {t.newIdeas}
              </Button>
            ) : null}
            <Button variant="outline" size="icon" aria-label={t.tabs.settings} title={t.tabs.settings} onClick={() => selectTab("settings")}>
              <Settings aria-hidden="true" />
            </Button>
          </>
        }
      />

      {props.notice ? (
        <Notice tone={props.notice.kind === "connected" ? "success" : "warning"}>
          {format(t.notice[props.notice.kind], { platform: noticePlatform })}
        </Notice>
      ) : null}
      {props.level === "trial" ? <Notice>{t.trialNote}</Notice> : null}

      <MetaStrip ready={ready} approved={props.approvedToday} goal={props.goal} credits={props.credits} t={t} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-1 self-start rounded-xl border bg-muted/40 p-1">
          {(["ideas", "videos", "posted", "settings"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => selectTab(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.tabs[key]}
              {counts[key] > 0 ? <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts[key]}</span> : null}
            </button>
          ))}
        </div>
        {tab === "ideas" && props.ideas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <NativeLikeSelect
              aria-label={t.filter.label}
              className={`${selectClass} w-40`}
              value={filter}
              onChange={(event) => setFilter(event.target.value as FormatFilter)}
            >
              <option value="all">{t.filter.all}</option>
              <option value="reel">{t.filter.reel}</option>
              <option value="carousel">{t.filter.carousel}</option>
            </NativeLikeSelect>
            <Button variant={focus ? "secondary" : "outline"} size="lg" onClick={() => setFocus(!focus)}>
              {focus ? <PanelRight aria-hidden="true" /> : <Focus aria-hidden="true" />}
              {focus ? t.focus.off : t.focus.on}
            </Button>
          </div>
        ) : null}
      </div>

      {tab === "ideas" ? (
        <IdeasDeck
          {...props}
          gone={gone}
          setGone={setGone}
          filter={filter}
          onFilter={setFilter}
          focus={focus}
          onFocus={setFocus}
          complete={complete}
          run={run}
          pending={pending}
        />
      ) : tab === "videos" ? (
        <MadeList {...props} run={run} pending={pending} onSettings={() => selectTab("settings")} />
      ) : tab === "posted" ? (
        <PostedList posted={props.posted} locale={props.locale} t={t} onTab={selectTab} />
      ) : (
        <SettingsPanel {...props} run={run} pending={pending} />
      )}
    </div>
  );
}

/**
 * The three numbers above the tabs (client, 2026-11-02, "he especially likes
 * this strip"), each read from the database: today's ideas not made or
 * skipped, the makes since midnight against the day's goal, and the
 * workspace's balance - left out for a guest, whose credits these are not.
 */
function MetaStrip(props: { ready: number; approved: number; goal: number; credits: { available: number; label: string } | null; t: T }) {
  const { t, approved, goal } = props;
  const chip = "flex h-8 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-xs text-muted-foreground";
  return (
    <ul className="flex flex-wrap gap-2">
      <li className={chip}>
        <Lightbulb className="size-3.5 shrink-0" aria-hidden="true" />
        <strong className="font-semibold text-foreground">{plural(t.meta.ideas, props.ready)}</strong>
        {plural(t.meta.ideasLabel, props.ready)}
      </li>
      <li className={chip}>
        {approved >= goal ? (
          <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <Clapperboard className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <strong className="font-semibold text-foreground tabular-nums">
          {approved} / {goal}
        </strong>
        {t.meta.madeLabel}
        <span
          role="progressbar"
          aria-label={format(t.today, { approved: String(approved), goal: String(goal) })}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(approved, goal)}
          className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (approved / Math.max(goal, 1)) * 100)}%` }} />
        </span>
      </li>
      {props.credits ? (
        <li>
          <Link href="/credits" className={`${chip} transition-colors hover:text-foreground`}>
            <Coins className="size-3.5 shrink-0" aria-hidden="true" />
            <strong className="font-semibold text-foreground">{props.credits.label}</strong>
            {plural(t.meta.credits, props.credits.available)}
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

type Run = (action: () => Promise<VideoResult<unknown>>, success?: string, after?: () => void) => void;

// ---------------------------------------------------------------- ideas

function IdeasDeck(props: {
  websiteId: string;
  canEdit: boolean;
  ideas: IdeaView[];
  gone: Set<string>;
  setGone: React.Dispatch<React.SetStateAction<Set<string>>>;
  filter: FormatFilter;
  onFilter: (filter: FormatFilter) => void;
  focus: boolean;
  onFocus: (on: boolean) => void;
  writing: boolean;
  complete: boolean;
  goal: number;
  priceLabel: string;
  settings: VideoSettings;
  media: MediaView[];
  tracks: TrackView[];
  run: Run;
  pending: boolean;
  t: T;
}) {
  const { t, websiteId, gone, setGone, focus, onFocus } = props;
  const router = useRouter();
  const [lastSkipped, setLastSkipped] = useState<string | null>(null);
  const [editing, setEditing] = useState<IdeaView | null>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  // The card with the preview, and whether the last press was on it: arrows then scroll its slides.
  const card = useRef<HTMLDivElement | null>(null);
  const pressedCard = useRef(false);

  const inFormat = props.ideas.filter((idea) => props.filter === "all" || idea.format === props.filter);
  const deck = inFormat.filter((idea) => !gone.has(idea.id));
  const current = deck[0];
  const total = inFormat.length;
  const position = total - deck.length + 1;

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
    async (idea: IdeaView, action: Promise<VideoResult<unknown>>, success?: string, onUndo?: () => void) => {
      setGone((set) => new Set(set).add(idea.id));
      const result = await action.catch(() => null);
      if (!result || !result.ok) {
        back(idea.id);
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return;
      }
      if (success) {
        toast.success(success, onUndo ? { duration: UNDO_SECONDS * 1000, action: { label: t.undo, onClick: onUndo } } : undefined);
      }
      router.refresh();
    },
    [router, t, props.priceLabel, back, setGone],
  );

  // A make by mistake: taken back within UNDO_SECONDS, the credit returned.
  const undoMake = useCallback(
    async (idea: IdeaView) => {
      const result = await undoVideoIdea(websiteId, idea.id).catch(() => null);
      if (!result || !result.ok) {
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return;
      }
      back(idea.id);
      toast.success(t.undone);
      router.refresh();
    },
    [websiteId, t, props.priceLabel, back, router],
  );

  const approve = useCallback(
    (idea: IdeaView, edit: IdeaEdit = {}, via: MakeVia = "button") => {
      void settle(idea, approveVideoIdea(websiteId, idea.id, edit, via), t.approved, () => void undoMake(idea));
      setLastSkipped(null);
    },
    [settle, websiteId, t.approved, undoMake],
  );
  const skip = useCallback(
    (idea: IdeaView) => {
      void settle(idea, skipVideoIdea(websiteId, idea.id));
      setLastSkipped(idea.id);
    },
    [settle, websiteId],
  );

  useEffect(() => {
    if (!current || !props.canEdit || editing) return;
    const onPress = (event: PointerEvent) => {
      pressedCard.current = Boolean(card.current?.contains(event.target as Node));
    };
    const onKey = (event: KeyboardEvent) => {
      // Not Alt+→ (the browser's Forward), a held key, a field or button, or after a press on the preview.
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

  // Esc leaves focus mode - not while the edit dialog is open (Esc closes that first).
  useEffect(() => {
    if (!focus || editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, editing, onFocus]);

  if (props.writing && props.ideas.length === 0) {
    return (
      <EmptyState icon={<Loader2 className="size-6 animate-spin" aria-hidden="true" />} title={t.writingIdeas} body={t.writingIdeasBody} />
    );
  }
  if (!current) {
    // Ideas left in another format: the filter hides them, they are not used up.
    const others = props.ideas.filter((idea) => !gone.has(idea.id)).length;
    return others > 0 ? (
      <EmptyState
        icon={<Clapperboard className="size-6" aria-hidden="true" />}
        title={t.list.empty}
        body={`${plural(t.meta.ideas, others)} ${plural(t.meta.ideasLabel, others)}`}
      >
        <Button variant="outline" onClick={() => props.onFilter("all")}>
          {t.filter.all}
        </Button>
      </EmptyState>
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
  const kind = current.format === "carousel" ? format(t.detail.carouselSlides, { count: String(slideCount(current.props.script)) }) : t.reel;

  return (
    <div className={focus ? "mx-auto w-full max-w-2xl" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}>
      <section aria-label={current.title} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span className="uppercase tracking-wide">{format(t.ideaOf, { index: String(Math.min(position, total)), count: String(total) })}</span>
          {focus ? <Badge variant="secondary">{kind}</Badge> : null}
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
          <p className="mt-2 text-center text-xs text-muted-foreground">{t.previewNote}</p>
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
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    const id = lastSkipped;
                    setLastSkipped(null);
                    back(id);
                    props.run(() => restoreVideoIdea(websiteId, id));
                  }}
                >
                  <Undo2 aria-hidden="true" />
                  {t.undo}
                </Button>
              ) : null}
            </div>
            <p className="text-center text-xs text-muted-foreground">{t.swipeHint}</p>
          </div>
        ) : null}
        {focus ? <p className="text-center text-xs text-muted-foreground">{t.focus.hint}</p> : null}
      </section>

      {focus ? null : <IdeaDetail key={current.id} idea={current} kind={kind} settings={props.settings} t={t} />}

      {editing ? (
        <EditDialog
          idea={editing}
          websiteId={websiteId}
          media={props.media}
          tracks={props.tracks}
          priceLabel={props.priceLabel}
          onClose={() => setEditing(null)}
          onApprove={(edit) => {
            const idea = editing;
            setEditing(null);
            approve(idea, edit);
          }}
          run={props.run}
          t={t}
        />
      ) : null}
    </div>
  );
}

/** The panel beside the preview (client's mockup): the hook, the points, the post text, where it goes. */
function IdeaDetail({ idea, kind, settings, t }: { idea: IdeaView; kind: string; settings: VideoSettings; t: T }) {
  const [open, setOpen] = useState(false);
  const captionId = useId();
  const script = idea.props.script;
  // Short texts are shown whole; only a long one folds.
  const long = idea.caption.length > 240 || idea.caption.split("\n").length > 5;
  const carousel = idea.format === "carousel";
  const platforms = settings.platforms.filter((platform) => !carousel || VIDEO_PLATFORM_SPECS[platform].carousel);

  return (
    <aside aria-label={t.detail.eyebrow} className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.detail.eyebrow}</span>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{kind}</Badge>
          <Badge variant="outline">{t.styles[idea.style as VideoStyle] ?? idea.style}</Badge>
        </div>
      </div>
      <h2 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{idea.title}</h2>

      <div className="rounded-xl border bg-muted/40 p-3.5">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Quote className="size-3" aria-hidden="true" />
          {t.detail.hook}
        </p>
        <p className="text-sm">{script.hook}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.detail.concept}</h3>
        <ScriptSummary script={script} t={t} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.caption}</h3>
        <p id={captionId} className={`text-sm whitespace-pre-line text-muted-foreground ${long && !open ? "line-clamp-4" : ""}`}>
          {idea.caption}
        </p>
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

function PlatformDots({ platforms }: { platforms: VideoPlatform[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {platforms.map((platform) => (
        <li key={platform} title={platformName(platform)} className="flex size-7 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          <BrandIcon name={platform} className="size-3.5" />
          <span className="sr-only">{platformName(platform)}</span>
        </li>
      ))}
    </ul>
  );
}

function ScriptSummary({ script, t }: { script: VideoScript; t: T }) {
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
      <li className="text-muted-foreground">
        {t.proof}: {script.proof}
      </li>
      <li className="text-muted-foreground">
        {t.cta}: {script.cta}
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

function EmptyState({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-16 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- editing

function EditDialog(props: {
  idea: IdeaView;
  websiteId: string;
  media: MediaView[];
  tracks: TrackView[];
  priceLabel: string;
  onClose: () => void;
  onApprove: (edit: IdeaEdit) => void;
  run: Run;
  t: T;
}) {
  const { t, idea } = props;
  const [script, setScript] = useState<VideoScript>(idea.props.script);
  const [caption, setCaption] = useState(idea.caption);
  const [style, setStyle] = useState(idea.style);
  const [formatValue, setFormat] = useState(idea.format);
  const [voice, setVoice] = useState<string | null>(idea.voice);
  const [music, setMusic] = useState<string | null>(idea.musicTrack);
  const [captions, setCaptions] = useState(idea.captions);
  const [media, setMedia] = useState(idea.props.media);

  const edit: IdeaEdit = { script, caption, style, format: formatValue, voice, musicTrack: music, captions };
  const preview: ReelProps = { ...idea.props, script, style: style as VideoStyle, captions, media };

  const setPoint = (index: number, change: Partial<VideoScript["points"][number]>) =>
    setScript((value) => ({ ...value, points: value.points.map((point, at) => (at === index ? { ...point, ...change } : point)) }));

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t.editTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="mx-auto w-full max-w-[260px]">
            {formatValue === "carousel" ? <CarouselPreview props={preview} /> : <ReelPreview props={preview} autoPlay={false} />}
          </div>
          <div className="space-y-4">
            <Field label={t.hook}>
              <Input value={script.hook} maxLength={80} onChange={(event) => setScript({ ...script, hook: event.target.value })} />
            </Field>
            {script.points.map((point, index) => (
              <fieldset key={index} className="space-y-2 rounded-xl border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">{format(t.point, { index: String(index + 1) })}</legend>
                <Field label={t.pointTitle}>
                  <Input value={point.title} maxLength={48} onChange={(event) => setPoint(index, { title: event.target.value })} />
                </Field>
                <Field label={t.pointDetail}>
                  <Input value={point.detail} maxLength={180} onChange={(event) => setPoint(index, { detail: event.target.value })} />
                </Field>
                {style === "numbers" ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={t.statValue}>
                      <Input
                        type="number"
                        value={point.stat?.value ?? ""}
                        onChange={(event) =>
                          setPoint(index, {
                            stat: event.target.value === "" ? null : { value: Number(event.target.value), suffix: point.stat?.suffix ?? "", label: point.stat?.label ?? "" },
                          })
                        }
                      />
                    </Field>
                    <Field label={t.statSuffix}>
                      <Input value={point.stat?.suffix ?? ""} maxLength={6} disabled={!point.stat} onChange={(event) => point.stat && setPoint(index, { stat: { ...point.stat, suffix: event.target.value } })} />
                    </Field>
                    <Field label={t.statLabel}>
                      <Input value={point.stat?.label ?? ""} maxLength={40} disabled={!point.stat} onChange={(event) => point.stat && setPoint(index, { stat: { ...point.stat, label: event.target.value } })} />
                    </Field>
                  </div>
                ) : null}
                {script.points.length > 2 ? (
                  <Button variant="ghost" size="sm" onClick={() => setScript({ ...script, points: script.points.filter((_, at) => at !== index) })}>
                    {t.removePoint}
                  </Button>
                ) : null}
              </fieldset>
            ))}
            {script.points.length < 4 ? (
              <Button variant="outline" size="sm" onClick={() => setScript({ ...script, points: [...script.points, { title: "", detail: "", stat: null }] })}>
                {t.addPoint}
              </Button>
            ) : null}
            <Field label={t.proof}>
              <Input value={script.proof} maxLength={160} onChange={(event) => setScript({ ...script, proof: event.target.value })} />
            </Field>
            <Field label={t.cta}>
              <Input value={script.cta} maxLength={80} onChange={(event) => setScript({ ...script, cta: event.target.value })} />
            </Field>
            <Field label={t.caption}>
              <Textarea value={caption} rows={4} maxLength={2200} onChange={(event) => setCaption(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.style}>
                <NativeLikeSelect className={selectClass} value={style} onChange={(event) => setStyle(event.target.value)}>
                  {VIDEO_STYLES.map((value) => (
                    <option key={value} value={value}>
                      {t.styles[value]}
                    </option>
                  ))}
                </NativeLikeSelect>
              </Field>
              <Field label={t.format}>
                <NativeLikeSelect className={selectClass} value={formatValue} onChange={(event) => setFormat(event.target.value)}>
                  <option value="reel">{t.reel}</option>
                  <option value="carousel">{t.carousel}</option>
                </NativeLikeSelect>
              </Field>
              {formatValue === "reel" ? (
                <>
                  <Field label={t.voice}>
                    <NativeLikeSelect className={selectClass} value={voice ?? ""} onChange={(event) => setVoice(event.target.value || null)}>
                      <option value="">{t.voiceOff}</option>
                      {VOICES.map((value) => (
                        <option key={value} value={value}>
                          {value[0].toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </NativeLikeSelect>
                  </Field>
                  <Field label={t.music}>
                    <NativeLikeSelect
                      className={selectClass}
                      value={music ?? ""}
                      onChange={(event) => setMusic(event.target.value === "" ? null : event.target.value)}
                    >
                      <option value="">{t.musicAuto}</option>
                      <option value="none">{t.musicNone}</option>
                      {props.tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title}
                        </option>
                      ))}
                    </NativeLikeSelect>
                  </Field>
                </>
              ) : null}
            </div>
            {formatValue === "reel" ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={captions} onCheckedChange={setCaptions} />
                {t.captions}
              </label>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.pictures}</p>
              {media.length === 0 ? <p className="text-xs text-muted-foreground">{t.noPictures}</p> : null}
              <div className="flex flex-wrap gap-2">
                {media.map((item) => (
                  <MediaThumb
                    key={item.url}
                    url={item.url}
                    kind={item.kind}
                    removeLabel={t.remove}
                    onRemove={() =>
                      props.run(() => removeMediaFromIdea(props.websiteId, idea.id, item.url), undefined, () =>
                        setMedia((list) => list.filter((entry) => entry.url !== item.url)),
                      )
                    }
                  />
                ))}
              </div>
              {props.media.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">{t.addPicture}</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {props.media
                      .filter((item) => !media.some((entry) => entry.url === item.url))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="rounded-lg ring-primary hover:ring-2"
                          onClick={() =>
                            props.run(() => addMediaToIdea(props.websiteId, idea.id, item.url, item.kind), undefined, () =>
                              setMedia((list) => [{ url: item.url, kind: item.kind }, ...list]),
                            )
                          }
                        >
                          <MediaThumb url={item.url} kind={item.kind} />
                        </button>
                      ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            {t.cancel}
          </Button>
          <Button variant="outline" onClick={() => props.run(() => editVideoIdea(props.websiteId, idea.id, edit), t.saved, props.onClose)}>
            {t.save}
          </Button>
          <Button onClick={() => props.onApprove(edit)}>
            <Check aria-hidden="true" />
            {t.saveAndApprove} · {props.priceLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MediaThumb({ url, kind, onRemove, removeLabel }: { url: string; kind: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <div className="relative size-16 overflow-hidden rounded-lg border bg-muted">
      {kind === "video" ? (
        <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      )}
      {onRemove ? (
        <button type="button" aria-label={removeLabel ?? "Remove"} onClick={onRemove} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white">
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- your videos

function MadeList(props: {
  websiteId: string;
  canEdit: boolean;
  made: IdeaView[];
  accounts: VideoAccountView[];
  bundle: boolean;
  settings: VideoSettings;
  priceLabel: string;
  run: Run;
  pending: boolean;
  onSettings: () => void;
  locale: Locale;
  t: T;
}) {
  const { t } = props;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FormatFilter>("all");
  if (props.made.length === 0) return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noVideos} body={t.noVideosBody} />;
  const connected = props.accounts.filter((account) => account.connected && !account.pausedReason);
  const words = query.trim().toLocaleLowerCase(props.locale);
  const shown = props.made.filter(
    (idea) => (kind === "all" || idea.format === kind) && (!words || `${idea.title} ${idea.caption}`.toLocaleLowerCase(props.locale).includes(words)),
  );
  return (
    <div className="space-y-4">
      {props.bundle && connected.length === 0 ? <Notice>{t.connectFirst}</Notice> : null}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.list.search} aria-label={t.list.search} className="h-9 pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <NativeLikeSelect aria-label={t.format} className={`${selectClass} w-40`} value={kind} onChange={(event) => setKind(event.target.value as FormatFilter)}>
            <option value="all">{t.list.all}</option>
            <option value="reel">{t.list.reels}</option>
            <option value="carousel">{t.list.carousels}</option>
          </NativeLikeSelect>
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
            {format(t.list.count, { shown: String(shown.length), total: String(props.made.length) })}
          </span>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Search className="size-6" aria-hidden="true" />} title={t.list.empty} body={t.noVideosBody} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((idea) => (
            <MadeCard key={idea.id} idea={idea} connected={connected} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A made video's length, as its render works it out (voice, scenes and closing card), in seconds. */
const reelSeconds = (idea: IdeaView) => Math.round(reelFrames(idea.props) / REEL.fps);

function MadeCard(props: {
  idea: IdeaView;
  connected: VideoAccountView[];
  websiteId: string;
  canEdit: boolean;
  settings: VideoSettings;
  priceLabel: string;
  run: Run;
  pending: boolean;
  onSettings: () => void;
  locale: Locale;
  t: T;
}) {
  const { idea, t, websiteId } = props;
  const [dialog, setDialog] = useState<"preview" | "publish" | null>(null);
  const carousel = idea.format === "carousel";
  const available = props.connected.filter((account) => isVideoPlatform(account.platform) && (!carousel || VIDEO_PLATFORM_SPECS[account.platform].carousel));
  const working = ["approved", "making", "posting"].includes(idea.status);
  const tone = idea.status === "failed" ? "destructive" : idea.status === "ready" ? "default" : "secondary";
  const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
  const publishable = props.canEdit && ["ready", "scheduled", "failed"].includes(idea.status) && files;
  const length = carousel ? format(t.list.slides, { count: String(idea.slideUrls.length || slideCount(idea.props.script)) }) : format(t.list.seconds, { seconds: String(reelSeconds(idea)) });

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[4/5] bg-muted">
        {working ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            <p className="max-w-[220px]">{idea.status === "posting" ? t.publishing : t.makingBody}</p>
          </div>
        ) : idea.videoUrl ? (
          // The first frame as the cover (#t asks the browser for it); Preview plays it.
          <video src={`${idea.videoUrl}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" className="size-full object-cover" />
        ) : idea.slideUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.slideUrls[0]} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Clapperboard className="size-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-foreground uppercase shadow-sm">
          {carousel ? t.carousel : t.reel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 font-medium leading-snug">{idea.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={tone as "default"}>{t.status[idea.status as keyof T["status"]] ?? idea.status}</Badge>
            {files ? <span className="tabular-nums">{length}</span> : null}
          </div>
        </div>

        {idea.status === "failed" ? (
          <Notice tone="danger">
            {idea.error ? `${errorNote(t, idea.error)} ` : ""}
            {!files ? t.failedBody : ""}
          </Notice>
        ) : idea.error && isCode(t, idea.error) ? (
          <Notice tone="warning">{errorNote(t, idea.error)}</Notice>
        ) : null}
        {idea.status === "scheduled" && idea.scheduledFor ? (
          <p className="text-sm text-muted-foreground">
            {format(t.scheduledFor, { date: formatDate(idea.scheduledFor, props.locale, { dateStyle: "medium", timeStyle: "short" }) })} ·{" "}
            {idea.platforms.map(platformName).join(", ")}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!files} onClick={() => setDialog("preview")}>
            <Eye aria-hidden="true" />
            {t.list.preview}
          </Button>
          {idea.videoUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={idea.videoUrl} download target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                {t.download}
              </a>
            </Button>
          ) : (
            // A carousel is several files: each slide is downloaded from the preview.
            <Button variant="outline" size="sm" disabled={!files} onClick={() => setDialog("preview")}>
              <Download aria-hidden="true" />
              {t.download}
            </Button>
          )}
          <Button
            size="sm"
            disabled={!publishable || props.pending}
            // No account to publish to yet: Settings is where they are connected.
            onClick={() => (available.length > 0 ? setDialog("publish") : props.onSettings())}
          >
            <Send aria-hidden="true" />
            {t.list.publish}
          </Button>
        </div>
        {props.canEdit && idea.status === "failed" && !files ? (
          <Button size="sm" disabled={props.pending} onClick={() => props.run(() => approveVideoIdea(websiteId, idea.id, {}, "retry"), t.approved)}>
            <RefreshCw aria-hidden="true" />
            {t.retry} · {props.priceLabel}
          </Button>
        ) : null}
        {props.canEdit && idea.status === "scheduled" ? (
          <Button variant="ghost" size="sm" disabled={props.pending} onClick={() => props.run(() => unscheduleVideoIdea(websiteId, idea.id))}>
            {t.unschedule}
          </Button>
        ) : null}
      </div>

      {dialog === "preview" ? <PreviewDialog idea={idea} length={length} locale={props.locale} t={t} onClose={() => setDialog(null)} /> : null}
      {dialog === "publish" ? <PublishDialog {...props} available={available} onClose={() => setDialog(null)} /> : null}
    </article>
  );
}

function PreviewDialog({ idea, length, locale, t, onClose }: { idea: IdeaView; length: string; locale: Locale; t: T; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{idea.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="mx-auto w-full max-w-[280px]">
            {idea.videoUrl ? (
              <video src={idea.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-xl bg-black object-contain" />
            ) : (
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
                {idea.slideUrls.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={format(t.slide, { index: String(index + 1) })} className="w-[85%] shrink-0 snap-center rounded-lg" />
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{idea.format === "carousel" ? t.carousel : t.reel}</Badge>
              <span className="tabular-nums">{length}</span>
              {idea.scheduledFor && idea.status === "scheduled" ? (
                <span>{format(t.scheduledFor, { date: formatDate(idea.scheduledFor, locale, { dateStyle: "medium", timeStyle: "short" }) })}</span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t.caption}</p>
              <p className="rounded-xl border bg-muted/30 p-3 text-sm whitespace-pre-line">{idea.caption}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {idea.videoUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={idea.videoUrl} download target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" />
                    {t.download}
                  </a>
                </Button>
              ) : null}
              {idea.slideUrls.map((url, index) => (
                <Button key={url} asChild variant="outline" size="sm">
                  <a href={url} download target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" />
                    {format(t.downloadSlide, { index: String(index + 1) })}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.list.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog(props: {
  idea: IdeaView;
  available: VideoAccountView[];
  websiteId: string;
  settings: VideoSettings;
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
  onClose: () => void;
}) {
  const { idea, t, websiteId } = props;
  const carousel = idea.format === "carousel";
  const platforms = props.available.map((account) => account.platform);
  const [chosen, setChosen] = useState<string[]>(() => {
    const wanted = idea.platforms.length > 0 ? idea.platforms : props.settings.platforms;
    const picked = platforms.filter((platform) => (wanted as string[]).includes(platform));
    return picked.length > 0 ? picked : platforms;
  });
  const [at, setAt] = useState("");
  const scheduled = (result: { at: string }) =>
    format(t.scheduledToast, { date: formatDate(result.at, props.locale, { dateStyle: "medium", timeStyle: "short" }) });

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{idea.title}</DialogTitle>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t.publishTo}</legend>
          <div className="flex flex-wrap gap-2">
            {props.available.map((account) => (
              <label key={account.platform} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(account.platform)}
                  onChange={(event) =>
                    setChosen((list) => (event.target.checked ? [...list, account.platform] : list.filter((entry) => entry !== account.platform)))
                  }
                />
                {platformName(account.platform)}
              </label>
            ))}
          </div>
          {/* A Pin needs its board: said here, and refused by the server too (errors.no_board). */}
          {props.available.some((account) => isVideoPlatform(account.platform) && VIDEO_PLATFORM_SPECS[account.platform].board && !account.board) ? (
            <Notice tone="warning">
              {t.pinterest.noBoard}{" "}
              <Link href={opportunitiesHref(websiteId)} className="font-medium underline underline-offset-2">
                {t.pinterest.chooseBoard}
              </Link>
            </Notice>
          ) : null}
          {carousel ? <p className="text-xs text-muted-foreground">{t.carouselNote}</p> : null}
        </fieldset>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={props.pending || chosen.length === 0}
              onClick={() => props.run(() => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: "now" }), t.published, props.onClose)}
            >
              {t.publishNow}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || chosen.length === 0}
              onClick={() => start(props, () => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: "best" }), scheduled, props.onClose)}
            >
              {t.publishBest}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className="h-8 min-w-0" aria-label={t.publishAt} />
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || !at || chosen.length === 0}
              onClick={() => start(props, () => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: new Date(at).toISOString() }), scheduled, props.onClose)}
            >
              {t.schedule}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Runs an action whose success message needs its result. */
function start<D>(props: { run: Run }, action: () => Promise<VideoResult<D>>, success: (data: D) => string, after?: () => void) {
  let message = "";
  props.run(
    async () => {
      const result = await action();
      if (result.ok) message = success(result.data);
      return result;
    },
    undefined,
    () => {
      if (message) toast.success(message);
      after?.();
    },
  );
}

// ---------------------------------------------------------------- posted

function PostedList({ posted, locale, t, onTab }: { posted: IdeaView[]; locale: Locale; t: T; onTab: (tab: Tab) => void }) {
  if (posted.length === 0) {
    return (
      <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noPosted} body={t.noVideosBody}>
        <Button onClick={() => onTab("ideas")}>
          <Sparkles aria-hidden="true" />
          {t.postedEmpty.ideas}
        </Button>
        <Button variant="outline" onClick={() => onTab("videos")}>
          {t.postedEmpty.videos}
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {posted.map((idea) => (
        <div key={idea.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{idea.title}</p>
            <p className="text-sm text-muted-foreground">
              {idea.postedAt ? formatDate(idea.postedAt, locale, { dateStyle: "medium", timeStyle: "short" }) : ""} ·{" "}
              {format(t.totalViews, { count: formatNumber(idea.views, locale) })}
            </p>
            {idea.error ? <p className="mt-1 text-xs text-destructive">{errorNote(t, idea.error)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {idea.platforms.map((platform) => {
              const stats = idea.stats[platform];
              const url = idea.postedUrls[platform];
              return (
                <div key={platform} className="rounded-xl border px-3 py-2 text-xs">
                  <div className="flex items-center gap-1 font-medium">
                    {platformName(platform)}
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" aria-label={`${t.open} ${platformName(platform)}`} className="text-primary">
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                  {stats ? (
                    <div className="mt-1 flex gap-2 text-muted-foreground">
                      <span>
                        {t.views} {formatNumber(stats.views, locale)}
                      </span>
                      <span>
                        {t.likes} {formatNumber(stats.likes, locale)}
                      </span>
                      <span>
                        {t.comments} {formatNumber(stats.comments, locale)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- settings

async function upload(websiteId: string, file: File): Promise<VideoResult<{ url: string; kind: "image" | "video" }>> {
  const prepared = await prepareVideoUpload(websiteId, { type: file.type, size: file.size });
  if (!prepared.ok) return prepared;
  const response = await fetch(prepared.data.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!response.ok) return { ok: false, error: "bad_file" };
  return { ok: true, data: { url: prepared.data.publicUrl, kind: prepared.data.kind } };
}

/** One of the Settings tab's four cards (client's mockup): a title, a line under it, the controls. */
function SettingsCard({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="space-y-1">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </section>
  );
}

function SettingsPanel(props: {
  websiteId: string;
  canEdit: boolean;
  bundle: boolean;
  settings: VideoSettings;
  brand: BrandLook;
  media: MediaView[];
  accounts: VideoAccountView[];
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
}) {
  const { t, websiteId, settings } = props;
  const [busyUpload, setBusyUpload] = useState(false);
  const save = (change: Partial<VideoSettings>) => props.run(() => saveVideoSettingsAction(websiteId, change), t.saved);
  const disabled = !props.canEdit || props.pending;

  async function uploadFiles(files: FileList | null, use: "library" | "logo") {
    if (!files?.length) return;
    setBusyUpload(true);
    try {
      for (const file of Array.from(files)) {
        const result = await upload(websiteId, file).catch(() => null);
        if (!result || !result.ok) {
          toast.error(result ? errorText(t, result, "") : t.errors.generic);
          continue;
        }
        if (use === "logo") {
          if (result.data.kind !== "image") {
            toast.error(t.errors.bad_file);
            continue;
          }
          props.run(() => saveVideoSettingsAction(websiteId, { logoUrl: result.data.url }), t.saved);
        } else {
          props.run(() => addVideoMedia(websiteId, result.data.url, result.data.kind, file.name));
        }
      }
    } finally {
      setBusyUpload(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SettingsCard title={t.accounts} body={t.accountsBody}>
        {!props.bundle ? <Notice tone="warning">{t.notConfigured}</Notice> : null}
        <ul className="divide-y">
          {VIDEO_PLATFORMS.map((platform) => {
            const account = props.accounts.find((row) => row.platform === platform);
            const paused = account?.pausedReason !== null && account?.pausedReason !== undefined;
            const board = VIDEO_PLATFORM_SPECS[platform].board;
            return (
              <li key={platform} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                    <BrandIcon name={platform} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{VIDEO_PLATFORM_SPECS[platform].name}</p>
                    {account?.connected ? (
                      <p className="text-xs break-all text-muted-foreground">
                        {t.connected} · {account.username}
                      </p>
                    ) : null}
                    {paused ? <p className="text-xs text-amber-700 dark:text-amber-400">{format(t.paused, { reason: account?.pausedReason ?? "" })}</p> : null}
                    {board && account?.connected ? (
                      account.board ? (
                        <p className="text-xs text-muted-foreground">
                          {format(t.pinterest.board, { board: account.board })} ·{" "}
                          <Link href={opportunitiesHref(websiteId)} className="text-primary hover:underline">
                            {t.pinterest.chooseBoard}
                          </Link>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t.pinterest.noBoard}{" "}
                          <Link href={opportunitiesHref(websiteId)} className="font-medium underline underline-offset-2">
                            {t.pinterest.chooseBoard}
                          </Link>
                        </p>
                      )
                    ) : null}
                    {board ? <p className="mt-0.5 text-xs text-muted-foreground">{t.pinterest.shared}</p> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  {paused ? (
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => props.run(() => resumeVideoPlatform(websiteId, platform), t.saved)}>
                      {t.resume}
                    </Button>
                  ) : null}
                  {account?.connected ? (
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => props.run(() => disconnectVideoPlatform(websiteId, platform))}>
                      {t.disconnect}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={disabled || !props.bundle}
                      onClick={() =>
                        props.run(async () => {
                          const result = await connectVideoPlatform(websiteId, platform, props.locale);
                          if (result.ok) window.location.assign(result.data.url);
                          return result;
                        })
                      }
                    >
                      {t.connect}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsCard>

      <SettingsCard title={t.cards.style} body={t.cards.styleBody}>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.defaultStyle}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {VIDEO_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                disabled={disabled}
                aria-pressed={settings.style === style}
                onClick={() => save({ style })}
                className={`rounded-xl border p-3 text-left text-sm transition ${settings.style === style ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30"}`}
              >
                <span className="font-medium">{t.styles[style]}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.styleHelp[style]}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label={t.defaultVoice}>
          <NativeLikeSelect className={selectClass} disabled={disabled} value={settings.voice ?? ""} onChange={(event) => save({ voice: (event.target.value || null) as VideoSettings["voice"] })}>
            <option value="">{t.voiceOff}</option>
            {VOICES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </NativeLikeSelect>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={settings.music} disabled={disabled} onCheckedChange={(music) => save({ music })} />
          {t.musicOn}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={settings.captions} disabled={disabled} onCheckedChange={(captions) => save({ captions })} />
          {t.captionsOn}
        </label>
      </SettingsCard>

      <SettingsCard title={t.cards.publishing} body={t.cards.publishingBody}>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.publishMode}</legend>
          {(["manual", "auto"] as const).map((mode) => (
            <label key={mode} className="flex items-start gap-2 rounded-xl border p-3 text-sm">
              <input type="radio" name="publish-mode" className="mt-1" disabled={disabled} checked={settings.publishMode === mode} onChange={() => save({ publishMode: mode })} />
              <span>
                <span className="font-medium">{mode === "auto" ? t.publishAuto : t.publishManual}</span>
                <span className="block text-xs text-muted-foreground">{mode === "auto" ? t.publishAutoHelp : t.publishManualHelp}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.platforms}</legend>
          <div className="flex flex-wrap gap-2">
            {VIDEO_PLATFORMS.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={settings.platforms.includes(platform)}
                  onChange={(event) =>
                    save({ platforms: event.target.checked ? [...settings.platforms, platform] : settings.platforms.filter((entry) => entry !== platform) })
                  }
                />
                {VIDEO_PLATFORM_SPECS[platform].name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t.carouselNote}</p>
        </fieldset>
      </SettingsCard>

      <SettingsCard title={t.cards.brand} body={t.cards.brandBody}>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.logo}</p>
          <p className="text-xs text-muted-foreground">{t.logoHelp}</p>
          <div className="flex flex-wrap items-center gap-3">
            {/* White on purpose: logos are drawn for a light background, as on the video's closing card. */}
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-white">
              {props.brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.brand.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : null}
            </div>
            <UploadButton label={busyUpload ? t.uploading : t.uploadLogo} disabled={disabled || busyUpload} accept="image/png,image/jpeg,image/webp" onFiles={(files) => uploadFiles(files, "logo")} />
            {settings.logoUrl ? (
              <Button variant="ghost" size="sm" disabled={disabled} onClick={() => save({ logoUrl: null })}>
                {t.removeLogo}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">{t.library}</p>
          <p className="text-xs text-muted-foreground">{t.libraryHelp}</p>
          <UploadButton
            label={busyUpload ? t.uploading : t.upload}
            disabled={disabled || busyUpload}
            multiple
            accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
            onFiles={(files) => uploadFiles(files, "library")}
          />
          <div className="flex flex-wrap gap-2">
            {props.media.map((item) => (
              <MediaThumb
                key={item.id}
                url={item.url}
                kind={item.kind}
                removeLabel={t.remove}
                onRemove={props.canEdit ? () => props.run(() => removeVideoMedia(websiteId, item.id)) : undefined}
              />
            ))}
          </div>
        </div>
      </SettingsCard>

      <details className="group rounded-2xl border bg-muted/30 p-4 lg:col-span-2">
        <summary className="cursor-pointer font-semibold">{t.safety}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {t.safetyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function UploadButton(props: { label: string; disabled: boolean; accept: string; multiple?: boolean; onFiles: (files: FileList | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={props.accept}
        multiple={props.multiple}
        onChange={(event) => {
          props.onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" disabled={props.disabled} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        {props.label}
      </Button>
    </>
  );
}
