"use client";

import { Bookmark, Check, ChevronDown, Copy, Download, ExternalLink, Lightbulb, Loader2, Rocket, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/workspace/notice";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import { compatibility } from "@/lib/video/destinations";
import { isVideoFormat, isVideoPlatform, REEL, VIDEO_PLATFORM_SPECS, type VideoPlatform } from "@/lib/video/formats";
import { saveYoutubeTags } from "@/lib/video/library-actions";
import { markVideoPosted, publishVideoIdea, unscheduleVideoIdea, type VideoPublishingStatus } from "@/lib/video/publish-actions";
import type { VideoSettings } from "@/lib/video/settings";
import { cleanTags, parseTags, suggestedTags, tagsLength, YOUTUBE_TAGS_MAX } from "@/lib/video/youtube-tags";

import { downloadUrl, manualPlatforms, PLATFORM_POST_URLS, platformText, postedOn } from "./logic";
import { reelFrames } from "./preview";
import { errorText, noteText, opportunitiesHref, platformName, startWith, type IdeaView, type Run, type T, type VideoAccountView, xWords } from "./shared";

type Mode = "manual" | "auto" | "save";
type Texts = Partial<Record<VideoPlatform, { title: string | null; caption: string }>>;

/** The customer's own edits of each platform's text, kept in this browser per video (a private window keeps them for the visit). */
const textsKey = (id: string) => `repget.videos.texts.${id}`;
function readTexts(id: string): Texts {
  try {
    const raw = window.localStorage.getItem(textsKey(id));
    return raw ? (JSON.parse(raw) as Texts) : {};
  } catch {
    return {};
  }
}
function writeTexts(id: string, texts: Texts) {
  try {
    window.localStorage.setItem(textsKey(id), JSON.stringify(texts));
  } catch {
    // Kept for this visit only.
  }
}

/** The window's actions say how it was closed: a publish or schedule closes it quietly; anything else is "saved for later". */
export type CloseReason = "saved" | "done";

/**
 * The publishing window (client, 2026-11-21; the mockup
 * repget-social-publishing-orange-download.html), opened straight after
 * Approve and from Saved Videos and Posted:
 *  - left: how to publish - Manual, Auto, or Save for later;
 *  - middle: the video - "Making your video…" until it is ready (the page
 *    looks again every few seconds), then the video;
 *  - right: in Manual, a tab per platform with its own editable title and
 *    text, and a Short's tags; in Auto, the connected accounts and Publish
 *    now / at the best time / at a chosen time, or a link to connect them;
 *    in Save for later, Save;
 *  - at the foot, always in view (Daniel, 2026-11-24): Download and, in
 *    Manual, Copy, Open <platform> and Mark as posted (no account needed).
 * Closing it any way is "save for later": the video waits in Saved Videos.
 * A video that could not be made says only that its idea is back.
 */
export function PublishPopup(props: {
  idea: IdeaView;
  websiteId: string;
  canEdit: boolean;
  accounts: VideoAccountView[];
  bundle: boolean;
  settings: VideoSettings;
  publishing: VideoPublishingStatus;
  priceLabel: string;
  run: Run;
  pending: boolean;
  locale: Locale;
  t: T;
  onClose: (reason: CloseReason) => void;
  /** Settings -> Publishing, where the accounts are connected. */
  onConnect: () => void;
  /** Today's ideas, where an idea that could not be made is again. */
  onIdeas: () => void;
}) {
  const { idea, t, websiteId, canEdit } = props;
  const p = t.flow.popup;
  const back = t.flow.library.returned;
  const [mode, setMode] = useState<Mode>("manual");
  const platforms = manualPlatforms(idea.format);
  const [active, setActive] = useState<VideoPlatform>(platforms[0] ?? "instagram");
  // The window only opens on a click, in the browser: its saved edits are read once (it is keyed by the video).
  const [texts, setTexts] = useState<Texts>(() => readTexts(idea.id));
  const making = idea.status === "approved" || idea.status === "making";
  const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
  const posted = postedOn(idea.destinations, platforms);
  // A Short's tags: the saved ones (never changed here), else a suggestion from the post, the video, the brand and the topics; saved on leaving the field and on closing.
  const [tags, setTags] = useState(
    () =>
      idea.youtubeTags ??
      suggestedTags({
        caption: idea.caption,
        title: idea.title,
        hook: idea.props?.script?.hook,
        points: idea.props?.script?.points?.map((point) => point.title),
        brand: idea.props?.brand?.name,
        topics: props.settings.priorityTopics,
      }),
  );
  const [savedTags, setSavedTags] = useState(tags);
  async function saveTags() {
    const clean = cleanTags(tags);
    setTags(clean);
    if (!canEdit || clean === savedTags) return;
    setSavedTags(clean);
    const result = await saveYoutubeTags(websiteId, idea.id, clean).catch(() => null);
    if (result?.ok) toast.success(t.flow.library.tags.saved, IN_WINDOW);
    else toast.error(t.errors.generic, IN_WINDOW);
  }
  function close(reason: CloseReason) {
    void saveTags();
    props.onClose(reason);
  }

  if (idea.status === "returned") {
    const tab = t.tabs.ideas;
    return (
      <Dialog open onOpenChange={(open) => !open && props.onClose("done")}>
        <DialogContent closeLabel={p.close} className="sm:max-w-md">
          <div className="flex items-start gap-3 pr-6" role="status">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lightbulb className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="leading-snug">{format(back.title, { tab })}</DialogTitle>
              <DialogDescription>{back.body}</DialogDescription>
              <p className="text-sm font-medium break-words">{idea.title}</p>
            </div>
          </div>
          <Button className="justify-self-end" onClick={props.onIdeas}>
            {format(back.open, { tab })}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close("saved")}>
      <DialogContent closeLabel={p.close} className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pr-12 sm:px-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{p.eyebrow}</p>
            <DialogTitle className="text-base leading-tight font-semibold">{p.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">{idea.title}</DialogDescription>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain lg:grid-cols-[230px_minmax(0,290px)_minmax(0,1fr)]">
          {/* How to publish */}
          <aside aria-label={p.question} className="flex flex-col gap-4 border-b p-4 sm:p-5 lg:border-r lg:border-b-0">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">{p.step}</p>
              <h3 className="mt-1 text-base leading-snug font-semibold">{p.question}</h3>
            </div>
            <div role="radiogroup" aria-label={p.question} className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {(["manual", "auto", "save"] as const).map((key) => {
                const Icon = key === "manual" ? Send : key === "auto" ? Rocket : Bookmark;
                const on = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMode(key)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${on ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"}`}
                  >
                    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{p.modes[key].title}</span>
                      <span className="block text-xs text-muted-foreground">{p.modes[key].body}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{p.notes[mode]}</p>
            <div className="mt-auto space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{format(p.progress, { count: String(posted.length), total: String(platforms.length) })}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(posted.length / Math.max(platforms.length, 1)) * 100}%` }} />
              </div>
            </div>
          </aside>

          {/* The video */}
          <section aria-label={p.preview} className="flex flex-col gap-3 border-b p-4 sm:p-5 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{p.preview}</span>
              <Badge variant="secondary">{idea.format === "carousel" ? t.carousel : idea.format === "story" ? t.viral.formats.story : t.reel}</Badge>
            </div>
            <p className="line-clamp-2 text-sm font-medium">{idea.title}</p>
            <VideoPane {...props} making={making} files={files} />
          </section>

          {/* What to do with it */}
          <section aria-label={p.modes[mode].title} className="min-w-0 p-4 sm:p-5">
            {mode === "manual" ? (
              <ManualPane
                {...props}
                platforms={platforms}
                active={active}
                onActive={setActive}
                texts={texts}
                onText={(platform, value) => {
                  const next = { ...texts, [platform]: value };
                  setTexts(next);
                  writeTexts(idea.id, next);
                }}
                tags={tags}
                onTags={setTags}
                onTagsDone={() => void saveTags()}
                making={making}
                files={files}
              />
            ) : mode === "auto" ? (
              <AutoPane {...props} making={making} files={files} />
            ) : (
              <div className="space-y-4">
                <Notice title={p.modes.save.title}>{p.saveBody}</Notice>
                <Button onClick={() => close("saved")}>
                  <Bookmark aria-hidden="true" />
                  {p.save}
                </Button>
              </div>
            )}
          </section>
        </div>

        <ActionBar {...props} mode={mode} active={active} text={texts[active] ?? platformText(idea, active)} making={making} files={files} />
      </DialogContent>
    </Dialog>
  );
}

type PaneProps = Omit<Parameters<typeof PublishPopup>[0], "onIdeas"> & { making: boolean; files: boolean };

/**
 * A toast this window still needs (a failure, the tags saved) comes at the
 * top of the screen: at the bottom right, sonner's place everywhere else, it
 * sat on the window's foot (Daniel, 2026-11-26: "it's covering the other
 * buttons and I have to wait it disappear").
 */
const IN_WINDOW = { position: "top-center" } as const;

/** How long a button says what it just did. */
const FLASH_MS = 2000;

/** A button's own "done" for two seconds, in place of a toast; a second click starts the two seconds again. */
function useFlash(ms = FLASH_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );
  return [message, flash] as const;
}

/** What a button just did, said politely to a screen reader (always in the page, so the change is announced). */
function Announce({ message }: { message: string | null }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message ?? ""}
    </span>
  );
}

/** A Copy button that answers in itself: "Copied" with a tick for two seconds; only a failure is a toast, at the top. */
function CopyButton(props: {
  value: () => string;
  label: string;
  p: T["flow"]["popup"];
  variant?: "outline" | "ghost";
  size?: "xs" | "default";
  className?: string;
  disabled?: boolean;
}) {
  const { p } = props;
  const [copied, flash] = useFlash();
  return (
    <>
      <Button
        type="button"
        variant={props.variant ?? "ghost"}
        size={props.size === "xs" ? "xs" : undefined}
        className={props.className}
        disabled={props.disabled}
        onClick={async () => {
          if (await copyTextNow(props.value())) flash(p.copied);
          else toast.error(p.copyFailed, IN_WINDOW);
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? p.copied : props.label}
      </Button>
      <Announce message={copied} />
    </>
  );
}

/**
 * The window's foot, outside what scrolls: Download, next to the active
 * platform's Copy, Open and Mark as posted in Manual (Daniel, 2026-11-24: "I
 * need to scroll for finding the download button"). Two by two on a phone.
 */
function ActionBar(props: PaneProps & { mode: Mode; active: VideoPlatform; text: { title: string | null; caption: string } }) {
  const { idea, t, active, text, files } = props;
  const p = t.flow.popup;
  const state = idea.destinations[active];
  const done = state?.status === "posted";
  const manual = props.mode === "manual";
  const wide = "h-auto min-h-9 min-w-0 px-2 py-1.5 leading-tight whitespace-normal sm:px-3";
  // Mark as posted answers in its button too (Daniel, 2026-11-26), not with a toast over the foot; only a refusal is a toast, at the top.
  const router = useRouter();
  const [marking, startMarking] = useTransition();
  const [marked, flashMarked] = useFlash();
  const [markedFor, setMarkedFor] = useState<{ platform: VideoPlatform; on: boolean } | null>(null);
  function mark() {
    const on = !done;
    const platform = active;
    startMarking(async () => {
      const result = await markVideoPosted(props.websiteId, idea.id, platform, on).catch(() => null);
      if (!result) return void toast.error(t.errors.generic, IN_WINDOW);
      if (!result.ok) return void toast.error(errorText(t, result, props.priceLabel), IN_WINDOW);
      setMarkedFor({ platform, on });
      flashMarked(format(on ? p.marked : p.unmarked, { platform: platformName(platform) }));
      router.refresh();
    });
  }
  return (
    <div role="group" aria-label={t.flow.library.actions.label} className={`shrink-0 border-t bg-popover p-3 sm:flex sm:flex-wrap sm:justify-end sm:gap-2 sm:px-5 ${manual ? "grid grid-cols-2 gap-2" : "grid"}`}>
      {idea.videoUrl ? (
        <Button asChild className={wide}>
          <a href={downloadUrl(idea.videoUrl, idea.title)} download target="_blank" rel="noreferrer">
            <Download aria-hidden="true" />
            {p.download}
          </a>
        </Button>
      ) : idea.slideUrls.length > 0 ? (
        // A carousel is several files: each slide from the menu (and under the slides).
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={wide}>
              <Download aria-hidden="true" />
              {t.flow.library.actions.slides}
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {idea.slideUrls.map((url, index) => (
              <DropdownMenuItem key={url} asChild>
                <a href={downloadUrl(url, idea.title, index)} download target="_blank" rel="noreferrer">
                  <Download aria-hidden="true" />
                  {format(t.downloadSlide, { index: String(index + 1) })}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button className={wide} disabled>
          <Download aria-hidden="true" />
          {p.download}
        </Button>
      )}
      {manual ? (
        <>
          <CopyButton variant="outline" className={wide} p={p} label={p.copyText} value={() => (text.title ? `${text.title}\n\n${text.caption}` : text.caption)} />
          <Button asChild variant="outline" className={wide}>
            <a href={PLATFORM_POST_URLS[active]} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              {format(p.open, { platform: platformName(active) })}
            </a>
          </Button>
          {props.canEdit && (!done || state?.manual) ? (
            <Button variant="outline" className={wide} disabled={props.pending || marking || props.making || !files} onClick={mark}>
              {marking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {marked && markedFor?.platform === active ? (markedFor.on ? p.postedBadge : p.markPosted) : done ? p.unmarkPosted : p.markPosted}
            </Button>
          ) : null}
          <Announce message={marked} />
        </>
      ) : null}
    </div>
  );
}

/** The middle column: being made, or the video (or slides). */
function VideoPane(props: PaneProps) {
  const { idea, t } = props;
  const p = t.flow.popup;
  const frame = "flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-4 text-center";
  if (props.making) {
    return (
      <div className={frame} role="status" aria-live="polite">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        <p className="font-medium">{p.making}</p>
        <p className="text-xs text-muted-foreground">{p.makingBody}</p>
      </div>
    );
  }
  if (!props.files) {
    return (
      <div className={frame}>
        <p className="font-medium">{t.noVideos}</p>
      </div>
    );
  }
  const seconds = idea.videoUrl ? Math.round(reelFrames(idea.props) / REEL.fps) : null;
  return (
    <div className="space-y-3">
      {idea.videoUrl ? (
        // As tall as the window leaves room for, so a laptop screen shows it whole.
        <video
          src={idea.videoUrl}
          poster={idea.coverUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="mx-auto aspect-[9/16] h-[min(462px,max(16rem,calc(100dvh-19rem)))] max-w-full rounded-2xl bg-black object-contain"
        />
      ) : (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
          {idea.slideUrls.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={format(t.slide, { index: String(index + 1) })} className="w-[85%] shrink-0 snap-center rounded-lg" />
          ))}
        </div>
      )}
      {seconds ? <p className="text-center text-xs text-muted-foreground tabular-nums">{format(t.list.seconds, { seconds: String(seconds) })}</p> : null}
      {idea.videoUrl ? null : (
        <div className="flex flex-wrap gap-2">
          {idea.slideUrls.map((url, index) => (
            <Button key={url} asChild variant="outline" size="sm">
              <a href={downloadUrl(url, idea.title, index)} download target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                {format(t.downloadSlide, { index: String(index + 1) })}
              </a>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Manual publishing: a tab per platform, its own title and text (and a Short's tags) to edit and copy; its actions are in the window's foot. */
function ManualPane(
  props: PaneProps & {
    platforms: VideoPlatform[];
    active: VideoPlatform;
    onActive: (platform: VideoPlatform) => void;
    texts: Texts;
    onText: (platform: VideoPlatform, value: { title: string | null; caption: string }) => void;
    tags: string;
    onTags: (value: string) => void;
    onTagsDone: () => void;
  },
) {
  const { idea, t, active } = props;
  const p = t.flow.popup;
  const ids = useId();
  const spec = VIDEO_PLATFORM_SPECS[active];
  const text = props.texts[active] ?? platformText(idea, active);
  const state = idea.destinations[active];
  const done = state?.status === "posted";
  const length = [...text.caption].length;


  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{p.textsTitle}</h3>
        <p className="text-xs text-muted-foreground">{p.textsBody}</p>
      </div>
      <div role="tablist" aria-label={p.textsTitle} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-x-visible">
        {props.platforms.map((platform) => {
          const on = platform === active;
          const out = idea.destinations[platform]?.status === "posted";
          return (
            <button
              key={platform}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => props.onActive(platform)}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              <BrandIcon name={platform} className="size-3.5" />
              {platformName(platform)}
              {out ? <Check className="size-3.5" aria-label={p.postedBadge} /> : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{platformName(active)}</strong>
          {done ? (
            <Badge className="bg-emerald-600 text-white">
              {p.postedBadge}
              {state?.manual ? ` · ${t.flow.posted.manual}` : ""}
            </Badge>
          ) : null}
        </div>
        {spec.titleMax ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${ids}-title`} className="text-xs font-medium text-muted-foreground">
                {p.titleLabel}
              </label>
              <CopyButton size="xs" p={p} label={p.copyTitle} value={() => text.title ?? ""} />
            </div>
            <Input
              id={`${ids}-title`}
              value={text.title ?? ""}
              maxLength={spec.titleMax}
              onChange={(event) => props.onText(active, { ...text, title: event.target.value })}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${ids}-caption`} className="text-xs font-medium text-muted-foreground">
              {p.captionLabel}
            </label>
            <CopyButton size="xs" p={p} label={p.copyText} value={() => text.caption} />
          </div>
          <Textarea
            id={`${ids}-caption`}
            rows={5}
            value={text.caption}
            aria-invalid={length > spec.captionMax || undefined}
            onChange={(event) => props.onText(active, { ...text, caption: event.target.value })}
          />
          <p className={`text-right text-xs tabular-nums ${length > spec.captionMax ? "text-destructive" : "text-muted-foreground"}`}>
            {format(p.chars, { count: String(length), max: String(spec.captionMax) })}
          </p>
        </div>
        {active === "youtube" ? <TagsField {...props} /> : null}
        {props.making ? <p className="text-xs text-muted-foreground">{p.waitVideo}</p> : null}
      </div>
    </div>
  );
}

/** A YouTube Short's tags, comma separated, counted as YouTube counts them (lib/video/youtube-tags.ts). */
function TagsField(props: { idea: IdeaView; canEdit: boolean; tags: string; onTags: (value: string) => void; onTagsDone: () => void; t: T }) {
  const { t, tags } = props;
  const p = t.flow.popup;
  const g = t.flow.library.tags;
  const id = useId();
  const length = tagsLength(parseTags(tags));
  const over = length > YOUTUBE_TAGS_MAX;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {g.label}
        </label>
        <CopyButton size="xs" p={p} label={g.copy} disabled={!tags.trim()} value={() => cleanTags(tags)} />
      </div>
      <Textarea
        id={id}
        rows={2}
        value={tags}
        readOnly={!props.canEdit}
        placeholder={g.placeholder}
        aria-describedby={`${id}-hint`}
        aria-invalid={over || undefined}
        className="min-h-14"
        onChange={(event) => props.onTags(event.target.value)}
        onBlur={props.onTagsDone}
      />
      <div id={`${id}-hint`} className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <p className={over ? "text-destructive" : undefined}>{over ? g.tooLong : `${props.idea.youtubeTags === null && tags ? `${g.suggested} ` : ""}${g.hint}`}</p>
        <p className={`shrink-0 tabular-nums ${over ? "text-destructive" : ""}`}>{format(p.chars, { count: String(length), max: String(YOUTUBE_TAGS_MAX) })}</p>
      </div>
    </div>
  );
}

/** A platform that cannot take this video, in words. */
function problemText(t: T, platform: string, code: string, duration: IdeaView["production"]["duration"]): string {
  const c = t.viral.compat;
  const words = c[code as keyof Omit<T["viral"]["compat"], "title">] ?? c.other;
  return format(words, { platform: platformName(platform), length: t.viral.durations[duration] });
}

/**
 * Automatic publishing through the connected accounts: the ones the video
 * can go to - a Story never where there are none, a video never past a
 * platform's length, X only within its limit, each said in words - then now,
 * at the best time, or at a chosen time. Only once the video is made; without
 * an account, a link to connect them (manual publishing still works).
 */
function AutoPane(props: PaneProps) {
  const { idea, t, websiteId } = props;
  const p = t.flow.popup;
  const v = t.viral;
  const carousel = idea.format === "carousel";
  const takes = props.accounts.filter((account) => account.connected && isVideoPlatform(account.platform) && (!carousel || VIDEO_PLATFORM_SPECS[account.platform].carousel));
  // An account resting, and X while RepGet's monthly budget for it is used up, are left out without a word: the video can be posted there by hand.
  const connected = takes.filter((account) => !account.paused && !(account.platform === "x" && props.publishing.x.reason === "limit_reached"));
  const note = noteText(t, idea.error);
  const platforms = connected.map((account) => account.platform).filter(isVideoPlatform);
  const length = carousel ? null : idea.videoUrl ? Math.round(reelFrames(idea.props) / REEL.fps) : idea.production.duration;
  const check = compatibility({ format: isVideoFormat(idea.format) ? idea.format : "reel", duration: length, platforms, xAvailable: props.publishing.x.available });
  // The server has the last word: an "incompatible" answer names its platforms, and they are blocked here too.
  const [refused, setRefused] = useState<Partial<Record<VideoPlatform, string>>>({});
  const blocked = new Map<VideoPlatform, string>();
  for (const [platform, code] of Object.entries({ ...check.problems, ...refused }) as [VideoPlatform, string][]) {
    blocked.set(platform, code === "x_not_configured" ? xWords(t, props.publishing) : problemText(t, platform, code, idea.production.duration));
  }
  if (platforms.includes("linkedin") && !props.publishing.linkedin.target) blocked.set("linkedin", v.linkedin.noTarget);
  const usable = platforms.filter((platform) => !blocked.has(platform));
  const already = postedOn(idea.destinations, platforms);
  const [chosen, setChosen] = useState<string[]>(() => {
    const wanted = idea.platforms.length > 0 ? idea.platforms : props.settings.platforms;
    const picked = usable.filter((platform) => (wanted as string[]).includes(platform) && !already.includes(platform));
    return picked.length > 0 ? picked : usable.filter((platform) => !already.includes(platform));
  });
  const [at, setAt] = useState("");
  const send = chosen.filter((platform) => usable.includes(platform as VideoPlatform) && !already.includes(platform));
  const publish = (when: string) => async () => {
    const result = await publishVideoIdea(websiteId, idea.id, { platforms: send, when });
    if (!result.ok && result.problems) setRefused(result.problems);
    return result;
  };
  const scheduled = (result: { at: string }) => format(t.scheduledToast, { date: formatDate(result.at, props.locale, { dateStyle: "medium", timeStyle: "short" }) });
  const done = () => props.onClose("done");

  if (props.making) return <Notice>{p.whenReady}</Notice>;
  if (!props.files) return <Notice>{t.flow.library.auto.unavailable}</Notice>;
  if (idea.status === "scheduled" && idea.scheduledFor) {
    return (
      <div className="space-y-3">
        <Notice tone="success">
          {format(t.scheduledFor, { date: formatDate(idea.scheduledFor, props.locale, { dateStyle: "medium", timeStyle: "short" }) })} · {idea.platforms.map(platformName).join(", ")}
        </Notice>
        {props.canEdit ? (
          <Button variant="outline" disabled={props.pending} onClick={() => props.run(() => unscheduleVideoIdea(websiteId, idea.id))}>
            {t.unschedule}
          </Button>
        ) : null}
      </div>
    );
  }
  if (props.bundle && takes.length > 0 && connected.length === 0) return <Notice title={t.flow.library.auto.unavailable}>{p.manualStill}</Notice>;
  if (!props.bundle || connected.length === 0) {
    return (
      <div className="space-y-3">
        <Notice title={p.noConnected}>
          {p.manualStill}
        </Notice>
        {props.canEdit && props.bundle ? (
          <Button onClick={props.onConnect}>
            <ExternalLink aria-hidden="true" />
            {p.connect}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {note ? <Notice>{note}</Notice> : null}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">{t.publishTo}</legend>
        <div className="flex flex-wrap gap-2">
          {connected.map((account) => {
            const platform = account.platform as VideoPlatform;
            const reason = blocked.get(platform);
            const out = already.includes(platform);
            return (
              <label key={platform} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${reason || out ? "opacity-60" : ""}`} title={reason}>
                <input
                  type="checkbox"
                  disabled={Boolean(reason) || out}
                  checked={!reason && !out && chosen.includes(platform)}
                  onChange={(event) => setChosen((list) => (event.target.checked ? [...list, platform] : list.filter((entry) => entry !== platform)))}
                />
                <BrandIcon name={platform} className="size-3.5" />
                {platformName(platform)}
                {out ? <Check className="size-3.5 text-emerald-600" aria-label={p.postedBadge} /> : null}
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
        {connected.some((account) => isVideoPlatform(account.platform) && VIDEO_PLATFORM_SPECS[account.platform].board && !account.board) ? (
          <Notice tone="warning">
            {t.pinterest.noBoard}{" "}
            <Link href={opportunitiesHref(websiteId)} className="font-medium underline underline-offset-2">
              {t.pinterest.chooseBoard}
            </Link>
          </Notice>
        ) : null}
        {carousel ? <p className="text-xs text-muted-foreground">{t.carouselNote}</p> : null}
        {idea.nativeAudio && send.includes("instagram") ? <p className="text-xs text-muted-foreground">{v.nativeAudio.honest}</p> : null}
        <p className="text-xs text-muted-foreground">{p.autoText}</p>
      </fieldset>
      {props.canEdit ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button disabled={props.pending || send.length === 0} onClick={() => props.run(publish("now"), t.published, done)}>
              <Send aria-hidden="true" />
              {t.publishNow}
            </Button>
            <Button variant="outline" disabled={props.pending || send.length === 0} onClick={() => startWith(props.run, publish("best"), scheduled, done)}>
              {t.publishBest}
            </Button>
          </div>
          <div className="flex max-w-md gap-2">
            <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className="min-w-0" aria-label={t.publishAt} />
            <Button variant="outline" disabled={props.pending || !at || send.length === 0} onClick={() => startWith(props.run, publish(new Date(at).toISOString()), scheduled, done)}>
              {t.schedule}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
