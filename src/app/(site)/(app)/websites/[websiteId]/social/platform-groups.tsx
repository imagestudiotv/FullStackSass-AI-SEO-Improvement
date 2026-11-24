"use client";

import { ChevronDown, Copy, ExternalLink, MoreHorizontal, SkipForward } from "lucide-react";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyTextNow } from "@/lib/copy-text";
import type { Locale } from "@/lib/i18n/config";
import { format, plural } from "@/lib/i18n/format";
import { OPPORTUNITIES_COPY } from "@/lib/i18n/opportunities";
import { SOCIAL_CONNECTIONS_COPY } from "@/lib/i18n/social-connections";
import { cn } from "@/lib/utils";

import {
  discussionUrl,
  groupName,
  isNew,
  latest,
  openAction,
  pasteText,
  platformName,
  stageOf,
  whereOf,
  type PlatformGroup,
  type Stage,
  type SuggestionView,
} from "./opportunities";
import { headline } from "./review-sheet";
import { Ago, atTime, PlatformTile, StageChip, useOneClickPost, type T } from "./social-shared";

/**
 * The opportunities, one row per platform that opens to its own (Daniel,
 * 2026-11-24, screenshots 06 and 07: "all suggestions in a more clean compact
 * design"), and on each opportunity a button that opens the real place: the
 * discussion to comment in, or the platform's page for a new post.
 */

/*
  Which platforms are open, kept in this browser for this website. Read
  through useSyncExternalStore, so the first render matches the server's (all
  closed) and the stored list follows; a write tells this tab and others.
*/
const OPEN_EVENT = "repget:opportunities-open";
const openKey = (websiteId: string) => `repget_opportunities_open_v1:${websiteId}`;
const openFallback = new Map<string, string>();

function readOpen(websiteId: string): string {
  try {
    return window.localStorage.getItem(openKey(websiteId)) ?? "[]";
  } catch {
    return openFallback.get(websiteId) ?? "[]";
  }
}

function subscribeOpen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(OPEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(OPEN_EVENT, onChange);
  };
}

function parseOpen(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeOpen(websiteId: string, platforms: string[]) {
  const raw = JSON.stringify(platforms);
  try {
    window.localStorage.setItem(openKey(websiteId), raw);
  } catch {
    // A private window: remembered for this visit only.
    openFallback.set(websiteId, raw);
  }
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type RowProps = {
  websiteId: string;
  /** An editor, and the platform is in the plan. */
  editable: (row: SuggestionView) => boolean;
  pending: boolean;
  onReview: (id: string) => void;
  onSkip: (row: SuggestionView) => void;
  priceLabel: string;
  locale: Locale;
  t: T;
};

export function PlatformGroups({
  groups,
  connected,
  filtered,
  ...props
}: RowProps & {
  groups: PlatformGroup[];
  connected: (platform: string) => boolean;
  /** A search or a platform filter: what matches is open without a click, and remembered as nothing. */
  filtered: boolean;
}) {
  const { websiteId, locale } = props;
  const raw = useSyncExternalStore(
    subscribeOpen,
    () => readOpen(websiteId),
    () => "[]",
  );
  const stored = useMemo(() => parseOpen(raw), [raw]);
  const [closed, setClosed] = useState<string[]>([]);
  const flip = (list: string[], platform: string) => (list.includes(platform) ? list.filter((item) => item !== platform) : [...list, platform]);

  return (
    <ul className="space-y-3 px-3 pb-4 sm:px-5">
      {groups.map((group) => (
        <Group
          key={group.platform}
          group={group}
          connected={connected(group.platform)}
          open={filtered ? !closed.includes(group.platform) : stored.includes(group.platform)}
          onToggle={() => (filtered ? setClosed(flip(closed, group.platform)) : writeOpen(websiteId, flip(stored, group.platform)))}
          {...props}
          locale={locale}
        />
      ))}
    </ul>
  );
}

function Group({
  group,
  connected,
  open,
  onToggle,
  ...props
}: RowProps & { group: PlatformGroup; connected: boolean; open: boolean; onToggle: () => void }) {
  const id = useId();
  const copy = OPPORTUNITIES_COPY[props.locale];
  const connections = SOCIAL_CONNECTIONS_COPY[props.locale];
  const total = group.rows.length;
  return (
    <li className="overflow-hidden rounded-xl border bg-card" data-platform={group.platform}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-rows`}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5 sm:py-4"
        >
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
          <PlatformTile platform={group.platform} size="xl" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{groupName(group.platform)}</span>
            <span className="block text-sm font-normal text-muted-foreground">
              {plural(copy.opportunities, total)} · {connected ? connections.connected : connections.notConnected}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold tabular-nums sm:flex-row sm:items-center sm:gap-3">
            {group.fresh > 0 ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary-strong">{format(copy.newCount, { count: String(group.fresh) })}</span>
            ) : null}
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{format(copy.totalCount, { count: String(total) })}</span>
          </span>
        </button>
      </h3>
      <div id={`${id}-rows`} hidden={!open} className="border-t">
        {total === 0 ? (
          <p className="px-5 py-5 text-sm text-muted-foreground">{copy.platformEmpty}</p>
        ) : (
          <ul className="divide-y">
            {group.rows.map((row) => (
              <Opportunity key={row.id} row={row} {...props} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** "Suggested post: ...", "Your draft: ...", by stage and kind. */
function leadOf(stage: Stage, kind: string, t: T): string | null {
  switch (stage) {
    case "suggested":
    case "failed":
      return kind === "reply" ? t.lead.suggestedReply : t.lead.suggestedPost;
    case "draft":
      return t.lead.draft;
    case "scheduled":
    case "publishing":
      return t.lead.scheduled;
    case "published":
      return kind === "reply" ? t.lead.publishedReply : t.lead.publishedPost;
  }
}

const SKIPPABLE: Stage[] = ["suggested", "draft", "scheduled", "failed"];

function Opportunity({ row, websiteId, editable, pending, onReview, onSkip, priceLabel, locale, t }: RowProps & { row: SuggestionView }) {
  const id = useId();
  const copy = OPPORTUNITIES_COPY[locale];
  const oneClick = useOneClickPost(websiteId, t, priceLabel);
  const stage = stageOf(row.status);
  const mine = editable(row);
  const name = platformName(row.platform);
  const reply = row.kind === "reply";
  const discussion = discussionUrl(row);
  const where = discussion ? whereOf(row) : null;
  const text = pasteText(row.title, row.body);
  const open = openAction(row, mine);
  // A suggestion's line is the discussion itself; from a draft on, the customer's own text.
  const summary = reply && stage === "suggested" && row.threadSnippet ? row.threadSnippet : row.body;
  const lead = summary === row.body ? leadOf(stage, row.kind, t) : null;
  const costs = stage !== "published" && priceLabel !== t.free;
  const review =
    stage === "suggested" || stage === "failed" ? t.review : stage === "draft" ? t.continue : stage === "scheduled" ? t.edit : t.details;

  async function copyText() {
    if (await copyTextNow(text)) toast.success(t.copyDone);
    else toast.error(t.errors.generic);
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-4 transition-colors hover:bg-muted/30 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="flex w-2 shrink-0 pt-7" aria-hidden="true">
          {isNew(row) ? <span className="size-2 rounded-full bg-primary" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {where && discussion ? (
              <a
                href={discussion}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={format(copy.sourceLabel, { where })}
                className="max-w-[14rem] truncate rounded-sm font-semibold text-foreground/80 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {where}
              </a>
            ) : (
              <span className="max-w-[14rem] truncate font-semibold text-foreground/80">{where ?? t.ownProfile}</span>
            )}
            <span aria-hidden="true">•</span>
            <Ago value={latest(row)} locale={locale} />
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold tracking-wide uppercase",
                reply ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-primary/10 text-primary-strong",
              )}
            >
              {reply ? copy.tagConversation : copy.tagPost}
            </span>
            {stage !== "suggested" && stage !== "failed" ? <StageChip stage={stage} t={t} /> : null}
            {stage === "scheduled" && row.scheduledFor ? (
              <time dateTime={row.scheduledFor} className="font-medium text-sky-700 dark:text-sky-300" suppressHydrationWarning>
                {atTime(row.scheduledFor, locale)}
              </time>
            ) : null}
          </div>
          <h4 id={`${id}-title`} className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold">
            {headline(row, t)}
          </h4>
          <p className="mt-1 line-clamp-2 text-sm break-words text-muted-foreground sm:line-clamp-1">
            {lead ? <span className="font-medium text-foreground/70">{lead}: </span> : null}
            {summary}
          </p>
          {stage === "failed" ? (
            <p className="mt-1 text-xs text-foreground/80">{row.error === "free_posts_used" ? t.errors.free_posts_used : t.failedCredits}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-5 lg:flex-nowrap lg:justify-end lg:pl-0">
        {open?.kind === "link" ? (
          <Button asChild size="sm" variant="outline">
            <a href={open.href} target="_blank" rel="noopener noreferrer" aria-describedby={`${id}-title`}>
              {open.published ? t.viewPost : format(copy.openOn, { platform: name })}
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        ) : open?.kind === "post" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={oneClick.pending || pending}
              aria-describedby={`${id}-title ${id}-help`}
              onClick={() => oneClick.post(row, text, { body: row.body, title: row.title ?? undefined })}
            >
              {format(reply ? copy.openOn : copy.createOn, { platform: name })}
              {costs ? <span className="font-normal text-muted-foreground">· {priceLabel}</span> : null}
              <ExternalLink aria-hidden="true" />
            </Button>
            <span id={`${id}-help`} className="sr-only">
              {format(costs ? copy.oneClickHelp : copy.oneClickHelpFree, { platform: name, price: priceLabel })}
              {stage === "scheduled" ? ` ${copy.scheduledHelp}` : ""}
            </span>
          </>
        ) : null}
        <Button
          size="sm"
          variant={stage === "suggested" ? "default" : "outline"}
          // The design's dark "Review": the one call to action per row, without a page of orange.
          className={cn("min-w-20", stage === "suggested" && "bg-foreground text-background hover:bg-foreground/85")}
          onClick={() => onReview(row.id)}
          aria-describedby={`${id}-title`}
        >
          {review}
        </Button>
        {/* Not modal: a modal menu handing the focus back fights the drawer it opens. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={t.more} aria-describedby={`${id}-title`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={copyText}>
              <Copy aria-hidden="true" />
              {t.copyText}
            </DropdownMenuItem>
            {discussion ? (
              <DropdownMenuItem asChild>
                <a href={discussion} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  {t.openThread}
                </a>
              </DropdownMenuItem>
            ) : null}
            {mine && SKIPPABLE.includes(stage) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={pending} onSelect={() => onSkip(row)}>
                  <SkipForward aria-hidden="true" />
                  {t.skip}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
