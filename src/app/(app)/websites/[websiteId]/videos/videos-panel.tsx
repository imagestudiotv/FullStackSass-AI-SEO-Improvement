"use client";

import { Check, Clapperboard, Download, ExternalLink, Loader2, Pencil, RefreshCw, Undo2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
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
  unscheduleVideoIdea,
  type IdeaEdit,
  type VideoError,
  type VideoResult,
} from "@/lib/video/actions";
import {
  isVideoPlatform,
  VIDEO_PLATFORM_SPECS,
  VIDEO_PLATFORMS,
  VIDEO_STYLES,
  VOICES,
  type BrandLook,
  type ReelProps,
  type VideoPlatform,
  type VideoScript,
  type VideoStyle,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

import { CarouselPreview, ReelPreview } from "./preview";

type T = VideosCopy;
type Tab = "ideas" | "videos" | "posted" | "settings";

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

export type VideoAccountView = { platform: string; username: string; connected: boolean; pausedReason: string | null };
type MediaView = { id: string; url: string; kind: "image" | "video"; name: string | null };
type TrackView = { id: string; title: string; mood: string };

const platformName = (platform: string) => (isVideoPlatform(platform) ? VIDEO_PLATFORM_SPECS[platform].name : platform);

function errorText(t: T, result: Extract<VideoResult<unknown>, { ok: false }>, price: string): string {
  const key: VideoError = result.error;
  if (key === "not_enough_credits") return format(t.errors.not_enough_credits, { price, available: String(result.available ?? 0) });
  return t.errors[key] ?? t.errors.generic;
}

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * The Videos page (client, 2026-10-29). Four tabs:
 *  - Today's ideas: twenty ideas as a swipe deck, each previewed with the
 *    real template - right (or →) makes it, left (or ←) skips it. After
 *    three the day shows complete; more can still be made, each a credit.
 *  - Your videos: being made, ready (download, publish now, at the best
 *    time, or at a chosen time, to the platforms chosen), scheduled.
 *  - Posted: where each video is, and its numbers.
 *  - Settings: the accounts, the defaults, the logo, the pictures and clips.
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
  priceLabel: string;
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
  const madeCount = props.made.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          props.canEdit && props.level !== "none" ? (
            <Button
              variant="outline"
              disabled={pending || props.ideas.length + props.approvedToday >= props.perDay}
              onClick={() => run(() => requestVideoIdeas(websiteId), t.ideasQueued)}
            >
              <RefreshCw aria-hidden="true" />
              {t.newIdeas}
            </Button>
          ) : null
        }
      />

      {props.notice ? (
        <Notice tone={props.notice.kind === "connected" ? "success" : "warning"}>
          {format(t.notice[props.notice.kind], { platform: noticePlatform })}
        </Notice>
      ) : null}
      {props.level === "trial" ? <Notice>{t.trialNote}</Notice> : null}

      <DayProgress approved={props.approvedToday} goal={props.goal} t={t} />

      <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
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
            {key === "videos" && madeCount > 0 ? <span className="ml-1.5 text-xs text-muted-foreground">{madeCount}</span> : null}
          </button>
        ))}
      </div>

      {tab === "ideas" ? (
        <IdeasDeck {...props} complete={complete} run={run} pending={pending} onMade={() => undefined} />
      ) : tab === "videos" ? (
        <MadeList {...props} run={run} pending={pending} />
      ) : tab === "posted" ? (
        <PostedList posted={props.posted} locale={props.locale} t={t} />
      ) : (
        <SettingsPanel {...props} run={run} pending={pending} />
      )}
    </div>
  );
}

function DayProgress({ approved, goal, t }: { approved: number; goal: number; t: T }) {
  const done = Math.min(approved, goal);
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: goal }, (_, index) => (
          <span key={index} className={`h-2 w-10 rounded-full ${index < done ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {approved >= goal ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Check className="size-4 text-emerald-600" aria-hidden="true" />
            {t.dayComplete}
          </span>
        ) : (
          format(t.today, { approved: String(approved), goal: String(goal) })
        )}
      </span>
    </div>
  );
}

type Run = (action: () => Promise<VideoResult<unknown>>, success?: string, after?: () => void) => void;

// ---------------------------------------------------------------- ideas

function IdeasDeck(props: {
  websiteId: string;
  canEdit: boolean;
  ideas: IdeaView[];
  writing: boolean;
  complete: boolean;
  goal: number;
  priceLabel: string;
  media: MediaView[];
  tracks: TrackView[];
  run: Run;
  pending: boolean;
  onMade: () => void;
  t: T;
}) {
  const { t, websiteId } = props;
  const router = useRouter();
  // Ideas handled on this screen leave the deck at once; the server agrees a moment later.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [lastSkipped, setLastSkipped] = useState<string | null>(null);
  const [editing, setEditing] = useState<IdeaView | null>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);

  const deck = props.ideas.filter((idea) => !gone.has(idea.id));
  const current = deck[0];
  const total = props.ideas.length;
  const position = total - deck.length + 1;

  const settle = useCallback(
    async (idea: IdeaView, action: Promise<VideoResult<unknown>>, success?: string) => {
      setGone((set) => new Set(set).add(idea.id));
      const result = await action.catch(() => null);
      if (!result || !result.ok) {
        setGone((set) => {
          const next = new Set(set);
          next.delete(idea.id);
          return next;
        });
        toast.error(result ? errorText(t, result, props.priceLabel) : t.errors.generic);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    },
    [router, t, props.priceLabel],
  );

  const approve = useCallback(
    (idea: IdeaView, edit: IdeaEdit = {}) => {
      void settle(idea, approveVideoIdea(websiteId, idea.id, edit), t.approved);
      setLastSkipped(null);
    },
    [settle, websiteId, t.approved],
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
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") approve(current);
      if (event.key === "ArrowLeft") skip(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, props.canEdit, editing, approve, skip]);

  if (props.writing && total === 0) {
    return (
      <EmptyState icon={<Loader2 className="size-6 animate-spin" aria-hidden="true" />} title={t.writingIdeas} body={t.writingIdeasBody} />
    );
  }
  if (!current) return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noIdeasLeft} body={t.noIdeasLeftBody} />;

  const swipeEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    if (drag > 120) approve(current);
    else if (drag < -120) skip(current);
    setDrag(0);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="mx-auto w-full max-w-[380px]">
        <div
          className="relative touch-pan-y select-none"
          style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)`, transition: dragging ? "none" : "transform 200ms ease" }}
          onPointerDown={(event) => {
            if (!props.canEdit || (event.target as HTMLElement).closest("button, input, [role=slider]")) return;
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
            <div className="rounded-2xl border bg-card p-3">
              <CarouselPreview props={current.props} />
            </div>
          ) : (
            <ReelPreview key={current.id} props={current.props} />
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.previewNote}</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{format(t.ideaOf, { index: String(Math.min(position, total)), count: String(total) })}</span>
          <Badge variant="secondary">{current.format === "carousel" ? t.carousel : t.reel}</Badge>
          <Badge variant="outline">{t.styles[current.style as VideoStyle] ?? current.style}</Badge>
        </div>
        <h2 className="text-xl font-semibold leading-tight">{current.title}</h2>
        <ScriptSummary script={current.props.script} t={t} />
        <div className="rounded-xl border bg-muted/30 p-3 text-sm whitespace-pre-line">{current.caption}</div>

        {props.complete ? <Notice tone="success" title={t.dayComplete}>{format(t.dayCompleteBody, { goal: String(props.goal) })}</Notice> : null}

        {props.canEdit ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="lg" onClick={() => skip(current)}>
                <X aria-hidden="true" />
                {t.skip}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setEditing(current)}>
                <Pencil aria-hidden="true" />
                {t.edit}
              </Button>
              <Button size="lg" onClick={() => approve(current)}>
                <Check aria-hidden="true" />
                {format(t.approve, { price: props.priceLabel })}
              </Button>
              {lastSkipped ? (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    const id = lastSkipped;
                    setLastSkipped(null);
                    setGone((set) => {
                      const next = new Set(set);
                      next.delete(id);
                      return next;
                    });
                    props.run(() => restoreVideoIdea(websiteId, id));
                  }}
                >
                  <Undo2 aria-hidden="true" />
                  {t.undo}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t.swipeHint}</p>
          </>
        ) : null}
      </div>

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

function ScriptSummary({ script, t }: { script: VideoScript; t: T }) {
  return (
    <ol className="space-y-2 text-sm">
      <li className="font-medium">“{script.hook}”</li>
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

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
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
                <select className={selectClass} value={style} onChange={(event) => setStyle(event.target.value)}>
                  {VIDEO_STYLES.map((value) => (
                    <option key={value} value={value}>
                      {t.styles[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.format}>
                <select className={selectClass} value={formatValue} onChange={(event) => setFormat(event.target.value)}>
                  <option value="reel">{t.reel}</option>
                  <option value="carousel">{t.carousel}</option>
                </select>
              </Field>
              {formatValue === "reel" ? (
                <>
                  <Field label={t.voice}>
                    <select className={selectClass} value={voice ?? ""} onChange={(event) => setVoice(event.target.value || null)}>
                      <option value="">{t.voiceOff}</option>
                      {VOICES.map((value) => (
                        <option key={value} value={value}>
                          {value[0].toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.music}>
                    <select
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
                    </select>
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

function MediaThumb({ url, kind, onRemove }: { url: string; kind: string; onRemove?: () => void }) {
  return (
    <div className="relative size-16 overflow-hidden rounded-lg border bg-muted">
      {kind === "video" ? (
        <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      )}
      {onRemove ? (
        <button type="button" aria-label="Remove" onClick={onRemove} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white">
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
  locale: Locale;
  t: T;
}) {
  const { t } = props;
  if (props.made.length === 0) return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noVideos} body={t.noVideosBody} />;
  const connected = props.accounts.filter((account) => account.connected && !account.pausedReason).map((account) => account.platform);
  return (
    <div className="space-y-4">
      {props.bundle && connected.length === 0 ? <Notice>{t.connectFirst}</Notice> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.made.map((idea) => (
          <MadeCard key={idea.id} idea={idea} connected={connected} {...props} />
        ))}
      </div>
    </div>
  );
}

function MadeCard(props: {
  idea: IdeaView;
  connected: string[];
  websiteId: string;
  canEdit: boolean;
  settings: VideoSettings;
  priceLabel: string;
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
}) {
  const { idea, t, websiteId } = props;
  const carousel = idea.format === "carousel";
  const available = props.connected.filter((platform) => !carousel || (isVideoPlatform(platform) && VIDEO_PLATFORM_SPECS[platform].carousel));
  const [chosen, setChosen] = useState<string[]>(() => {
    const wanted = idea.platforms.length > 0 ? idea.platforms : props.settings.platforms;
    const picked = available.filter((platform) => (wanted as string[]).includes(platform));
    return picked.length > 0 ? picked : available;
  });
  const [at, setAt] = useState("");
  const working = ["approved", "making", "posting"].includes(idea.status);
  const tone = idea.status === "failed" ? "destructive" : idea.status === "ready" ? "default" : "secondary";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 font-medium leading-snug">{idea.title}</p>
        <Badge variant={tone as "default"}>{t.status[idea.status as keyof T["status"]] ?? idea.status}</Badge>
      </div>

      {working ? (
        <div className="flex aspect-[9/16] max-h-[420px] flex-col items-center justify-center gap-2 rounded-xl bg-muted text-center text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <p className="max-w-[220px]">{idea.status === "posting" ? t.publishing : t.makingBody}</p>
        </div>
      ) : idea.videoUrl ? (
        <video src={idea.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[420px] w-full rounded-xl bg-black object-contain" />
      ) : idea.slideUrls.length > 0 ? (
        <div className="flex snap-x gap-2 overflow-x-auto">
          {idea.slideUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={format(t.slide, { index: String(index + 1) })} className="w-[70%] shrink-0 snap-center rounded-lg" />
          ))}
        </div>
      ) : null}

      {idea.status === "failed" ? (
        <Notice tone="danger">
          {idea.error ? `${idea.error} ` : ""}
          {!idea.videoUrl && !idea.slideUrls.length ? t.failedBody : ""}
        </Notice>
      ) : null}
      {idea.status === "scheduled" && idea.scheduledFor ? (
        <p className="text-sm text-muted-foreground">
          {format(t.scheduledFor, { date: formatDate(idea.scheduledFor, props.locale, { dateStyle: "medium", timeStyle: "short" }) })} ·{" "}
          {idea.platforms.map(platformName).join(", ")}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
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
        {props.canEdit && idea.status === "failed" && !idea.videoUrl && !idea.slideUrls.length ? (
          <Button size="sm" disabled={props.pending} onClick={() => props.run(() => approveVideoIdea(websiteId, idea.id), t.approved)}>
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

      {props.canEdit && ["ready", "scheduled", "failed"].includes(idea.status) && (idea.videoUrl || idea.slideUrls.length > 0) && available.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t.publishTo}</p>
          <div className="flex flex-wrap gap-2">
            {available.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.includes(platform)}
                  onChange={(event) => setChosen((list) => (event.target.checked ? [...list, platform] : list.filter((entry) => entry !== platform)))}
                />
                {platformName(platform)}
              </label>
            ))}
          </div>
          {carousel ? <p className="text-xs text-muted-foreground">{t.noCarouselOnYoutube}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={props.pending || chosen.length === 0}
              onClick={() => props.run(() => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: "now" }), t.published)}
            >
              {t.publishNow}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || chosen.length === 0}
              onClick={() =>
                start(props, () => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: "best" }), (result) =>
                  format(t.scheduledToast, { date: formatDate(result.at, props.locale, { dateStyle: "medium", timeStyle: "short" }) }),
                )
              }
            >
              {t.publishBest}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className="h-8" aria-label={t.publishAt} />
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || !at || chosen.length === 0}
              onClick={() =>
                start(props, () => publishVideoIdea(websiteId, idea.id, { platforms: chosen, when: new Date(at).toISOString() }), (result) =>
                  format(t.scheduledToast, { date: formatDate(result.at, props.locale, { dateStyle: "medium", timeStyle: "short" }) }),
                )
              }
            >
              {t.schedule}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Runs an action whose success message needs its result. */
function start<D>(props: { run: Run }, action: () => Promise<VideoResult<D>>, success: (data: D) => string) {
  let message = "";
  props.run(async () => {
    const result = await action();
    if (result.ok) message = success(result.data);
    return result;
  }, undefined, () => message && toast.success(message));
}

// ---------------------------------------------------------------- posted

function PostedList({ posted, locale, t }: { posted: IdeaView[]; locale: Locale; t: T }) {
  if (posted.length === 0) return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.noPosted} body={t.noVideosBody} />;
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
            {idea.error ? <p className="mt-1 text-xs text-destructive">{idea.error}</p> : null}
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
                      <a href={url} target="_blank" rel="noreferrer" aria-label={t.open} className="text-primary">
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
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t.accounts}</h2>
        <p className="text-sm text-muted-foreground">{t.accountsBody}</p>
        {!props.bundle ? <Notice tone="warning">{t.notConfigured}</Notice> : null}
        <ul className="divide-y">
          {VIDEO_PLATFORMS.map((platform) => {
            const account = props.accounts.find((row) => row.platform === platform);
            return (
              <li key={platform} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{VIDEO_PLATFORM_SPECS[platform].name}</p>
                  {account?.connected ? <p className="text-xs text-muted-foreground">{t.connected} · {account.username}</p> : null}
                  {account?.pausedReason !== null && account?.pausedReason !== undefined ? (
                    <p className="text-xs text-amber-700">{format(t.paused, { reason: account.pausedReason })}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {account?.pausedReason !== null && account?.pausedReason !== undefined ? (
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
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t.defaults}</h2>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.defaultStyle}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {VIDEO_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                disabled={disabled}
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
          <select className={selectClass} disabled={disabled} value={settings.voice ?? ""} onChange={(event) => save({ voice: (event.target.value || null) as VideoSettings["voice"] })}>
            <option value="">{t.voiceOff}</option>
            {VOICES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={settings.music} disabled={disabled} onCheckedChange={(music) => save({ music })} />
          {t.musicOn}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={settings.captions} disabled={disabled} onCheckedChange={(captions) => save({ captions })} />
          {t.captionsOn}
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.publishMode}</p>
          {(["manual", "auto"] as const).map((mode) => (
            <label key={mode} className="flex items-start gap-2 text-sm">
              <input type="radio" name="publish-mode" className="mt-1" disabled={disabled} checked={settings.publishMode === mode} onChange={() => save({ publishMode: mode })} />
              <span>
                <span className="font-medium">{mode === "auto" ? t.publishAuto : t.publishManual}</span>
                <span className="block text-xs text-muted-foreground">{mode === "auto" ? t.publishAutoHelp : t.publishManualHelp}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.platforms}</p>
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
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t.logo}</h2>
        <p className="text-sm text-muted-foreground">{t.logoHelp}</p>
        <div className="flex items-center gap-3">
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
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t.library}</h2>
        <p className="text-sm text-muted-foreground">{t.libraryHelp}</p>
        <UploadButton
          label={busyUpload ? t.uploading : t.upload}
          disabled={disabled || busyUpload}
          multiple
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
          onFiles={(files) => uploadFiles(files, "library")}
        />
        <div className="flex flex-wrap gap-2">
          {props.media.map((item) => (
            <MediaThumb key={item.id} url={item.url} kind={item.kind} onRemove={props.canEdit ? () => props.run(() => removeVideoMedia(websiteId, item.id)) : undefined} />
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border bg-muted/30 p-4 lg:col-span-2">
        <h2 className="font-semibold">{t.safety}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {t.safetyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
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
