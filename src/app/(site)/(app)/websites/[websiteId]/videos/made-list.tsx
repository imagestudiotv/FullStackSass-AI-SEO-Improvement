"use client";

import { Clapperboard, Download, Eye, Loader2, Music2, RefreshCw, Search, Send } from "lucide-react";
import { useState } from "react";

import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { InstagramAudio } from "@/lib/social/bundle";
import { approveVideoIdea } from "@/lib/video/actions";
import { REEL, slideCount } from "@/lib/video/formats";
import { connectVideoPlatform, searchInstagramAudio, setNativeAudio, type VideoPublishingStatus } from "@/lib/video/publish-actions";
import type { VideoSettings } from "@/lib/video/settings";
import { COVER_FALLBACK_SECONDS, coverSeconds } from "@/remotion/cover";

import type { FormatFilter } from "./logic";
import { reelFrames } from "./preview";
import { DestinationChips, EmptyState, errorNote, errorText, isCode, type IdeaView, type OpenPublish, selectClass, type Run, type T, type VideoAccountView } from "./shared";

/** A made video's length, as its render works it out (voice, scenes and closing card), in seconds. */
const reelSeconds = (idea: IdeaView) => Math.round(reelFrames(idea.props) / REEL.fps);
/**
 * When a video without a cover still is shown: the moment its opening is
 * fully drawn, from its own timing (src/remotion/cover.ts) - never the
 * first frame, where scenes fade in and the first caption word sits alone.
 */
function coverMoment(idea: IdeaView): number {
  try {
    const seconds = coverSeconds(idea.props);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : COVER_FALLBACK_SECONDS;
  } catch {
    return COVER_FALLBACK_SECONDS;
  }
}
const formatLabel = (t: T, format: string) => (format === "carousel" ? t.carousel : format === "story" ? t.viral.formats.story : t.reel);

type ListProps = {
  websiteId: string;
  canEdit: boolean;
  made: IdeaView[];
  accounts: VideoAccountView[];
  bundle: boolean;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  priceLabel: string;
  run: Run;
  pending: boolean;
  /** The publishing window (publish-popup.tsx), the same as after Approve. */
  onPublish: OpenPublish;
  locale: Locale;
  t: T;
};

/**
 * Saved Videos (client, 2026-11-21; "Your videos" before): the approved
 * videos not scheduled or published yet - being made, ready, or failed.
 * Search and filter, then a card per video: Preview, Download, Publish (the
 * publishing window), Instagram audio, Try again. Scheduled and published
 * videos are on Posted.
 */
export function MadeList(props: ListProps) {
  const { t } = props;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FormatFilter>("all");
  if (props.made.length === 0) return <EmptyState icon={<Clapperboard className="size-6" aria-hidden="true" />} title={t.flow.saved.emptyTitle} body={t.flow.saved.emptyBody} />;
  const connected = props.accounts.filter((account) => account.connected && !account.pausedReason);
  const words = query.trim().toLocaleLowerCase(props.locale);
  const shown = props.made.filter(
    (idea) => (kind === "all" || idea.format === kind) && (!words || `${idea.title} ${idea.caption}`.toLocaleLowerCase(props.locale).includes(words)),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.list.search} aria-label={t.list.search} className="h-9 pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <NativeLikeSelect aria-label={t.format} className={`${selectClass} w-40`} value={kind} onChange={(event) => setKind(event.target.value as FormatFilter)}>
            <option value="all">{t.list.all}</option>
            <option value="reel">{t.list.reels}</option>
            <option value="story">{t.viral.formats.stories}</option>
            <option value="carousel">{t.list.carousels}</option>
          </NativeLikeSelect>
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
            {format(t.list.count, { shown: String(shown.length), total: String(props.made.length) })}
          </span>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Search className="size-6" aria-hidden="true" />} title={t.list.empty} body={t.flow.saved.emptyBody} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((idea) => (
            <MadeCard key={idea.id} {...props} idea={idea} connected={connected} />
          ))}
        </div>
      )}
    </div>
  );
}

function MadeCard(props: ListProps & { idea: IdeaView; connected: VideoAccountView[] }) {
  const { idea, t, websiteId } = props;
  const v = t.viral;
  const [dialog, setDialog] = useState<"preview" | "audio" | null>(null);
  const carousel = idea.format === "carousel";
  const working = ["approved", "making", "posting"].includes(idea.status);
  const tone = idea.status === "failed" ? "destructive" : idea.status === "ready" || idea.status === "draft" ? "default" : "secondary";
  const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
  // The window opens while it is being made too: it shows the making, then the video.
  const publishable = props.canEdit && (files || working);
  const length = carousel ? format(t.list.slides, { count: String(idea.slideUrls.length || slideCount(idea.props.script)) }) : format(t.list.seconds, { seconds: String(reelSeconds(idea)) });
  // Instagram's own audio: reels only, once made, and only where Instagram is connected.
  const instagram = props.connected.some((account) => account.platform === "instagram");
  const audioChoice = props.canEdit && idea.format === "reel" && files && ["ready", "draft", "scheduled"].includes(idea.status) && instagram;
  const statusWords = idea.status === "ready" || idea.status === "draft" ? t.flow.saved.ready : (t.status[idea.status as keyof T["status"]] ?? idea.status);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[4/5] bg-muted">
        {working ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            <p className="max-w-[220px]">{idea.status === "posting" ? t.publishing : t.makingBody}</p>
          </div>
        ) : idea.videoUrl && idea.coverUrl ? (
          // The reel's cover still: its opening fully drawn, without captions (src/remotion/cover.ts). Preview plays it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.coverUrl} alt="" className="size-full object-cover" />
        ) : idea.videoUrl ? (
          // A video made before covers: the browser shows the MP4 at the cover's moment (#t), the opening fully drawn.
          <video src={`${idea.videoUrl}#t=${coverMoment(idea)}`} muted playsInline preload="metadata" aria-hidden="true" className="size-full object-cover" />
        ) : idea.slideUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.slideUrls[0]} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Clapperboard className="size-8" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-foreground uppercase shadow-sm">
          {formatLabel(t, idea.format)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 font-medium leading-snug">{idea.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={tone as "default"}>{statusWords}</Badge>
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
        <DestinationChips destinations={idea.destinations} postedUrls={idea.postedUrls} t={t} />
        {idea.nativeAudio ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Music2 className="size-3.5 shrink-0" aria-hidden="true" />
            {format(v.nativeAudio.chosen, { title: idea.nativeAudio.title, artist: idea.nativeAudio.artist ?? "" })}
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
          <Button size="sm" disabled={!publishable} onClick={() => props.onPublish(idea)}>
            <Send aria-hidden="true" />
            {t.list.publish}
          </Button>
          {audioChoice ? (
            <Button variant="outline" size="sm" onClick={() => setDialog("audio")}>
              <Music2 aria-hidden="true" />
              {v.nativeAudio.button}
            </Button>
          ) : null}
        </div>
        {props.canEdit && idea.status === "failed" && !files ? (
          <Button size="sm" disabled={props.pending} onClick={() => props.run(() => approveVideoIdea(websiteId, idea.id, {}, "retry"), t.approved)}>
            <RefreshCw aria-hidden="true" />
            {t.retry} · {props.priceLabel}
          </Button>
        ) : null}
      </div>

      {dialog === "preview" ? <PreviewDialog idea={idea} length={length} locale={props.locale} t={t} onClose={() => setDialog(null)} /> : null}
      {dialog === "audio" ? <NativeAudioDialog idea={idea} websiteId={websiteId} publishing={props.publishing} run={props.run} pending={props.pending} locale={props.locale} t={t} onClose={() => setDialog(null)} /> : null}
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
              <video src={idea.videoUrl} poster={idea.coverUrl ?? undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-xl bg-black object-contain" />
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
              <Badge variant="secondary">{formatLabel(t, idea.format)}</Badge>
              <span className="tabular-nums">{length}</span>
              {idea.scheduledFor && idea.status === "scheduled" ? (
                <span>{format(t.scheduledFor, { date: formatDate(idea.scheduledFor, locale, { dateStyle: "medium", timeStyle: "short" }) })}</span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t.caption}</p>
              <p className="rounded-xl border bg-muted/30 p-3 text-sm whitespace-pre-line">{idea.caption}</p>
            </div>
            {idea.nativeAudio ? <p className="text-xs text-muted-foreground">{t.viral.nativeAudio.honest}</p> : null}
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

/**
 * Instagram's own audio for a Reel (bundle.social's Instagram audio): searched
 * only when the account can use it (Facebook Login), nothing labelled
 * trending (Instagram's audio API gives no such data), the track's and the
 * video's volumes 0-100. RepGet cannot preview the final mix: Instagram
 * mixes it. The other platforms and the download keep RepGet's licensed music.
 */
function NativeAudioDialog(props: { idea: IdeaView; websiteId: string; publishing: VideoPublishingStatus; run: Run; pending: boolean; locale: Locale; t: T; onClose: () => void }) {
  const { idea, t } = props;
  const n = t.viral.nativeAudio;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracks, setTracks] = useState<InstagramAudio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eligibility = props.publishing.instagramAudio;
  // NATIVE_VOLUME (lib/video/native-audio.ts, server-only): 0-100, Instagram's default 100.
  const [volume, setVolume] = useState(idea.nativeAudio?.volume ?? 100);
  const [originalVolume, setOriginalVolume] = useState(idea.nativeAudio?.originalVolume ?? 100);

  async function search() {
    setBusy(true);
    setError(null);
    const found = await searchInstagramAudio(props.websiteId, query.trim()).catch(() => null);
    setBusy(false);
    if (!found) return setError(t.errors.generic);
    if (!found.ok) return setError(errorText(t, found, ""));
    setTracks(found.data.tracks);
  }

  const pick = (track: InstagramAudio | null) =>
    props.run(
      () =>
        setNativeAudio(
          props.websiteId,
          idea.id,
          // Instagram's API gives no trending data, so nothing is labelled trending.
          track ? { audioId: track.audioId, title: track.title, artist: track.artist, volume, originalVolume, trending: false } : null,
        ),
      track ? n.saved : n.removed,
      props.onClose,
    );

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{n.title}</DialogTitle>
          <DialogDescription>{n.reelsOnly}</DialogDescription>
        </DialogHeader>
        <Notice>
          <span className="block">{n.noPreview}</span>
          <span className="mt-1 block text-xs">{n.honest}</span>
        </Notice>
        {!eligibility.available ? (
          <Notice tone="warning">
            <span className="block">{n.reasons[eligibility.reason]}</span>
            {eligibility.reason === "needs_facebook_login" ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={props.pending}
                onClick={() =>
                  props.run(async () => {
                    const result = await connectVideoPlatform(props.websiteId, "instagram", props.locale, { facebookLogin: true });
                    if (result.ok) window.location.assign(result.data.url);
                    return result;
                  })
                }
              >
                {n.reconnect}
              </Button>
            ) : null}
          </Notice>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={n.search} aria-label={n.search} className="h-9 min-w-0" />
            <Button type="submit" size="lg" variant="outline" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
              {n.searchButton}
            </Button>
          </form>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {eligibility.available ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <VolumeField label={n.volume} value={volume} onChange={setVolume} />
            <VolumeField label={n.originalVolume} value={originalVolume} onChange={setOriginalVolume} />
          </div>
        ) : null}
        {idea.nativeAudio ? (
          <p className="text-xs text-muted-foreground">{format(n.chosen, { title: idea.nativeAudio.title, artist: idea.nativeAudio.artist ?? "" })}</p>
        ) : null}
        {tracks ? (
          tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{n.none}</p>
          ) : (
            <ul className="divide-y rounded-xl border" aria-live="polite">
              {tracks.map((track) => (
                <li key={track.audioId} className="flex items-center justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[track.artist, track.durationMs ? format(t.list.seconds, { seconds: String(Math.round(track.durationMs / 1000)) }) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant={idea.nativeAudio?.audioId === track.audioId ? "secondary" : "outline"} disabled={props.pending} onClick={() => pick(track)}>
                    {idea.nativeAudio?.audioId === track.audioId ? n.update : n.use}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
        <DialogFooter>
          {idea.nativeAudio ? (
            <Button variant="ghost" disabled={props.pending} onClick={() => pick(null)}>
              {n.remove}
            </Button>
          ) : null}
          <Button variant="outline" onClick={props.onClose}>
            {t.list.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A volume from 0 to 100, as Instagram takes it. */
function VolumeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="flex justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className="tabular-nums">{value}</span>
      </span>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-primary" />
    </label>
  );
}
