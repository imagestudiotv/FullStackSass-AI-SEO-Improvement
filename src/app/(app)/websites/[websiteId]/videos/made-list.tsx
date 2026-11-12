"use client";

import { Clapperboard, Download, Eye, Loader2, Music2, RefreshCw, Search, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import { approveVideoIdea, publishVideoIdea, unscheduleVideoIdea } from "@/lib/video/actions";
import { isVideoFormat, isVideoPlatform, REEL, slideCount, VIDEO_PLATFORM_SPECS, type VideoPlatform } from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

// TODO(viral-integration): connectVideoPlatform/searchInstagramAudio/setNativeAudio and
// VideoPublishingStatus from "@/lib/video/publish-actions"; compatibility from "@/lib/video/destinations"; InstagramAudio from "@/lib/social/bundle".
import {
  compatibility,
  connectVideoPlatform,
  searchInstagramAudio,
  setNativeAudio,
  type InstagramAudio,
  type VideoPublishingStatus,
} from "./_pending";
import { compatText } from "./edit-dialog";
import type { FormatFilter } from "./logic";
import { reelFrames } from "./preview";
import {
  DestinationChips,
  EmptyState,
  errorNote,
  errorText,
  isCode,
  opportunitiesHref,
  platformName,
  selectClass,
  startWith,
  type IdeaView,
  type Run,
  type T,
  type VideoAccountView,
  xWords,
} from "./shared";

/** A made video's length, as its render works it out (voice, scenes and closing card), in seconds. */
const reelSeconds = (idea: IdeaView) => Math.round(reelFrames(idea.props) / REEL.fps);
const formatLabel = (t: T, format: string) => (format === "carousel" ? t.carousel : format === "story" ? t.viral.formats.story : t.reel);
/** "Save as draft": a ready video waits as a draft, sent nowhere until the customer publishes it. */
const isDraft = (idea: IdeaView, settings: VideoSettings) => idea.status === "draft" || (idea.status === "ready" && settings.publishMode === "draft");

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
  onSettings: () => void;
  locale: Locale;
  t: T;
};

/** Your videos: search and filter, then a card per video - Preview, Download, Publish, Unschedule, Try again. */
export function MadeList(props: ListProps) {
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
            <option value="story">{t.viral.formats.stories}</option>
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
  const [dialog, setDialog] = useState<"preview" | "publish" | "audio" | null>(null);
  const carousel = idea.format === "carousel";
  const available = props.connected.filter((account) => isVideoPlatform(account.platform) && (!carousel || VIDEO_PLATFORM_SPECS[account.platform].carousel));
  const working = ["approved", "making", "posting"].includes(idea.status);
  const draft = isDraft(idea, props.settings);
  const tone = idea.status === "failed" ? "destructive" : idea.status === "ready" && !draft ? "default" : "secondary";
  const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
  const publishable = props.canEdit && ["ready", "draft", "scheduled", "failed"].includes(idea.status) && files;
  const length = carousel ? format(t.list.slides, { count: String(idea.slideUrls.length || slideCount(idea.props.script)) }) : format(t.list.seconds, { seconds: String(reelSeconds(idea)) });
  // Instagram's own audio: reels only, once made, and only where Instagram is connected.
  const instagram = props.connected.some((account) => account.platform === "instagram");
  const audioChoice = props.canEdit && idea.format === "reel" && files && ["ready", "draft", "scheduled"].includes(idea.status) && instagram;
  const statusWords = draft ? v.draft.badge : (t.status[idea.status as keyof T["status"]] ?? idea.status);

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
          {draft ? <p className="text-xs text-muted-foreground">{v.draft.body}</p> : null}
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
          <Button
            size="sm"
            disabled={!publishable || props.pending}
            // No account to publish to yet: Settings is where they are connected.
            onClick={() => (available.length > 0 ? setDialog("publish") : props.onSettings())}
          >
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
        {props.canEdit && idea.status === "scheduled" ? (
          <Button variant="ghost" size="sm" disabled={props.pending} onClick={() => props.run(() => unscheduleVideoIdea(websiteId, idea.id))}>
            {t.unschedule}
          </Button>
        ) : null}
      </div>

      {dialog === "preview" ? <PreviewDialog idea={idea} length={length} locale={props.locale} t={t} onClose={() => setDialog(null)} /> : null}
      {dialog === "publish" ? <PublishDialog {...props} available={available} onClose={() => setDialog(null)} /> : null}
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
 * Publish a made video: the connected platforms it can go to - a Story is
 * never sent where there are no Stories, a video never past a platform's
 * length, X only within its spending limit, each said in words - then now,
 * at the best time, or at a chosen time.
 */
function PublishDialog(props: {
  idea: IdeaView;
  available: VideoAccountView[];
  websiteId: string;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
  onClose: () => void;
}) {
  const { idea, t, websiteId } = props;
  const v = t.viral;
  const carousel = idea.format === "carousel";
  const platforms = props.available.map((account) => account.platform).filter(isVideoPlatform);
  // The made video's own length where it is known, else the length chosen for it.
  const length = carousel ? null : idea.videoUrl ? reelSeconds(idea) : idea.production.duration;
  const check = compatibility({ format: isVideoFormat(idea.format) ? idea.format : "reel", duration: length, platforms, xAvailable: props.publishing.x.available });
  const blocked = new Map<VideoPlatform, string>();
  for (const [platform, code] of Object.entries(check.problems) as [VideoPlatform, string][]) {
    blocked.set(platform, code === "x_not_configured" ? xWords(t, props.publishing) : compatText(t, { platform, code }, idea.production.duration));
  }
  const usable = platforms.filter((platform) => !blocked.has(platform));
  const [chosen, setChosen] = useState<string[]>(() => {
    const wanted = idea.platforms.length > 0 ? idea.platforms : props.settings.platforms;
    const picked = usable.filter((platform) => (wanted as string[]).includes(platform));
    return picked.length > 0 ? picked : usable;
  });
  const [at, setAt] = useState("");
  const scheduled = (result: { at: string }) => format(t.scheduledToast, { date: formatDate(result.at, props.locale, { dateStyle: "medium", timeStyle: "short" }) });
  const send = chosen.filter((platform) => usable.includes(platform as VideoPlatform));

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{idea.title}</DialogTitle>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t.publishTo}</legend>
          <div className="flex flex-wrap gap-2">
            {props.available.map((account) => {
              const reason = isVideoPlatform(account.platform) ? blocked.get(account.platform) : undefined;
              return (
                <label key={account.platform} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${reason ? "opacity-60" : ""}`} title={reason}>
                  <input
                    type="checkbox"
                    disabled={Boolean(reason)}
                    checked={!reason && chosen.includes(account.platform)}
                    onChange={(event) =>
                      setChosen((list) => (event.target.checked ? [...list, account.platform] : list.filter((entry) => entry !== account.platform)))
                    }
                  />
                  {platformName(account.platform)}
                </label>
              );
            })}
          </div>
          {blocked.size > 0 ? (
            <Notice tone="warning" title={v.compat.title}>
              <ul className="list-disc space-y-0.5 pl-5">
                {[...blocked.values()].map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
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
          {idea.nativeAudio && send.includes("instagram") ? <p className="text-xs text-muted-foreground">{v.nativeAudio.honest}</p> : null}
        </fieldset>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={props.pending || send.length === 0}
              onClick={() => props.run(() => publishVideoIdea(websiteId, idea.id, { platforms: send, when: "now" }), t.published, props.onClose)}
            >
              {t.publishNow}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || send.length === 0}
              onClick={() => startWith(props.run, () => publishVideoIdea(websiteId, idea.id, { platforms: send, when: "best" }), scheduled, props.onClose)}
            >
              {t.publishBest}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className="h-8 min-w-0" aria-label={t.publishAt} />
            <Button
              size="sm"
              variant="outline"
              disabled={props.pending || !at || send.length === 0}
              onClick={() => startWith(props.run, () => publishVideoIdea(websiteId, idea.id, { platforms: send, when: new Date(at).toISOString() }), scheduled, props.onClose)}
            >
              {t.schedule}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Instagram's own audio for a reel (bundle.social's Instagram audio, Worker
 * D): searched only when the account can use it; nothing is labelled
 * trending (Instagram's audio API gives no such data). The other platforms and the download keep
 * RepGet's licensed music.
 */
function NativeAudioDialog(props: { idea: IdeaView; websiteId: string; publishing: VideoPublishingStatus; run: Run; pending: boolean; locale: Locale; t: T; onClose: () => void }) {
  const { idea, t } = props;
  const n = t.viral.nativeAudio;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracks, setTracks] = useState<InstagramAudio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eligibility = props.publishing.instagramAudio;

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
          track ? { audioId: track.audioId, title: track.title, artist: track.artist, trending: false } : null,
        ),
      track ? n.saved : n.removed,
      props.onClose,
    );

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{n.title}</DialogTitle>
          <DialogDescription>{n.honest}</DialogDescription>
        </DialogHeader>
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
                    {idea.nativeAudio?.audioId === track.audioId ? n.current : n.use}
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
