"use client";

import { Check, ChevronDown, Clapperboard, Coins, Focus, Lightbulb, Loader2, PanelRight, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { NativeLikeSelect } from "@/components/ui/native-like-select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format, plural } from "@/lib/i18n/format";
import type { VideoResult } from "@/lib/video/actions";
import { EXTRA_BATCHES_PER_DAY, type BrandLook, type ExtraBatchKind } from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

// TODO(viral-integration): requestVideoIdeas(websiteId, kind, requestKey) from "@/lib/video/actions".
import { requestVideoIdeas } from "./_pending";
import type { IdeaAllowance, PublishingStatus, VideoProfile } from "./_pending-server";
import { IdeasDeck } from "./ideas-deck";
import type { CategoryFilter, FormatFilter } from "./logic";
import { MadeList } from "./made-list";
import { PostedList } from "./posted-list";
import { SettingsPanel, type SettingsPane } from "./settings-panel";
import { errorText, platformName, selectClass, type IdeaView, type MediaView, type T, type Tab, type TrackView, type VideoAccountView } from "./shared";

export type { IdeaView, VideoAccountView } from "./shared";

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

/** The New ideas menu's three batches (client's mockup), each ten free ideas. */
const BATCHES: ExtraBatchKind[] = ["mixed", "viral", "website"];

/**
 * The Social Content page (client, 2026-10-29; redesigned from the client's
 * mockups, 2026-11-02 and 2026-11-12). A strip of three real numbers - ideas
 * ready, made today against the day's goal, the credits available - then
 * four tabs:
 *  - Today's ideas: category chips and a format filter over the day's ideas,
 *    a swipe deck beside the idea's details (ideas-deck.tsx);
 *  - Your videos: cards with Preview, Download, Publish, Instagram audio (made-list.tsx);
 *  - Posted: where each video is, and its numbers (posted-list.tsx);
 *  - Settings: "Preferences" in panes, saved on the server (settings-panel.tsx).
 * "New ideas" asks for ten more free ideas: daily, viral or from the website.
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
  /** The free extra batches: used, left, one being written, or asked too soon. */
  allowance: Omit<IdeaAllowance, "nextAllowedAt"> & { tooSoon: boolean };
  priceLabel: string;
  /** The workspace's balance, for its owner only (null for a guest, or when it could not be read). */
  credits: { available: number; label: string } | null;
  settings: VideoSettings;
  profile: VideoProfile;
  publishing: PublishingStatus;
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
  const v = t.viral;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const [pane, setPane] = useState<SettingsPane>("strategy");
  const [pending, start] = useTransition();
  const [asking, startAsking] = useTransition();
  // Ideas handled on this screen leave the deck (and the count) at once; the server agrees a moment later.
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FormatFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
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
  const busy = props.writing || props.allowance.busy || props.made.some((idea) => ["approved", "making", "posting"].includes(idea.status));
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

  function ask(kind: ExtraBatchKind) {
    startAsking(async () => {
      const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const result = await requestVideoIdeas(websiteId, kind, key).catch(() => null);
      if (!result) return void toast.error(t.errors.generic);
      if (!result.ok) return void toast.error(errorText(t, result, props.priceLabel));
      toast.success(v.newIdeas.queued);
      // The new ones show where they belong: a viral batch under Viral, the others under All ideas.
      setCategory(kind === "viral" ? "viral" : "all");
      selectTab("ideas");
      router.refresh();
    });
  }

  const complete = props.approvedToday >= props.goal;
  const noticePlatform = props.notice?.platform ? platformName(props.notice.platform) : "";
  const ready = props.ideas.filter((idea) => !gone.has(idea.id)).length;
  const counts: Record<Tab, number> = { ideas: ready, videos: props.made.length, posted: props.posted.length, settings: 0 };
  const editable = props.canEdit && props.level !== "none";
  const { allowance } = props;
  const writingMore = asking || allowance.busy;
  const blocked = writingMore ? v.newIdeas.busy : allowance.extraLeft <= 0 ? v.newIdeas.usedUp : allowance.tooSoon ? v.newIdeas.tooSoon : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          <>
            {editable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" aria-busy={writingMore}>
                    {writingMore ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                    {writingMore ? v.newIdeas.writing : t.newIdeas}
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {format(v.newIdeas.left, { left: String(allowance.extraLeft), total: String(EXTRA_BATCHES_PER_DAY) })}
                  </DropdownMenuLabel>
                  {BATCHES.map((kind) => (
                    <DropdownMenuItem key={kind} disabled={Boolean(blocked)} onSelect={() => ask(kind)} className="items-start py-2">
                      <span className="flex flex-col">
                        <span className="font-medium">{v.newIdeas.kinds[kind].title}</span>
                        <span className="text-xs text-muted-foreground">{v.newIdeas.kinds[kind].body}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">{blocked ?? v.newIdeas.free}</p>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              aria-label={v.settings.open}
              title={v.settings.open}
              onClick={() => {
                setPane("strategy");
                selectTab("settings");
              }}
            >
              <Settings aria-hidden="true" />
            </Button>
          </>
        }
      />

      {props.notice ? (
        <Notice tone={props.notice.kind === "connected" ? "success" : "warning"}>{format(t.notice[props.notice.kind], { platform: noticePlatform })}</Notice>
      ) : null}
      {props.level === "trial" ? <Notice>{t.trialNote}</Notice> : null}
      {allowance.busy && props.ideas.length > 0 ? (
        <Notice>
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {v.newIdeas.queued}
          </span>
        </Notice>
      ) : null}

      <MetaStrip ready={ready} approved={props.approvedToday} goal={props.goal} credits={props.credits} t={t} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label={t.title} className="flex max-w-full gap-1 self-start overflow-x-auto rounded-xl border bg-muted/40 p-1">
          {(["ideas", "videos", "posted", "settings"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => selectTab(key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.tabs[key]}
              {counts[key] > 0 ? <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts[key]}</span> : null}
            </button>
          ))}
        </div>
        {tab === "ideas" && props.ideas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <NativeLikeSelect aria-label={t.filter.label} className={`${selectClass} w-40`} value={filter} onChange={(event) => setFilter(event.target.value as FormatFilter)}>
              <option value="all">{t.filter.all}</option>
              <option value="reel">{t.filter.reel}</option>
              <option value="story">{v.formats.stories}</option>
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
          category={category}
          onCategory={setCategory}
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
        <SettingsPanel {...props} pane={pane} onPane={setPane} run={run} pending={pending} />
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
