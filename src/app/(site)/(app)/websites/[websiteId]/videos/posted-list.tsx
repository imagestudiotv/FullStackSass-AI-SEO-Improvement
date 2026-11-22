"use client";

import { Clapperboard, ExternalLink, Loader2, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { isVideoPlatform } from "@/lib/video/formats";
import { unscheduleVideoIdea } from "@/lib/video/publish-actions";

import { DestinationChips, EmptyState, errorNote, platformName, type IdeaView, type OpenPublish, type Run, type T, type Tab } from "./shared";

/**
 * Posted: what is scheduled (with Unschedule), on its way, or out - where
 * each video is and its numbers; LinkedIn and X like the others, posts the
 * customer made by hand (marked in the publishing window) said so, and any
 * destination that failed or was skipped. Publish opens the publishing
 * window again, for the platforms it is not on yet.
 */
export function PostedList(props: {
  websiteId: string;
  canEdit: boolean;
  posted: IdeaView[];
  run: Run;
  pending: boolean;
  onPublish: OpenPublish;
  locale: Locale;
  t: T;
  onTab: (tab: Tab) => void;
}) {
  const { posted, locale, t, onTab } = props;
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
      {posted.map((idea) => {
        // The destinations that did not post (failed, skipped) are told apart from the posted ones below.
        const notPosted = Object.fromEntries(Object.entries(idea.destinations).filter(([, state]) => state.status !== "posted" && state.status !== "scheduled"));
        // Where it is: its platforms and any destination marked posted by hand.
        const shown = [...new Set([...idea.platforms, ...Object.keys(idea.destinations).filter((platform) => idea.destinations[platform]?.status === "posted")])].filter(isVideoPlatform);
        const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
        const scheduled = idea.status === "scheduled";
        return (
          <div key={idea.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{idea.title}</p>
                {scheduled || idea.status === "posting" ? (
                  <Badge variant="secondary">
                    {idea.status === "posting" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
                    {t.status[idea.status as "scheduled" | "posting"]}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {scheduled && idea.scheduledFor
                  ? format(t.scheduledFor, { date: formatDate(idea.scheduledFor, locale, { dateStyle: "medium", timeStyle: "short" }) })
                  : idea.postedAt
                    ? `${formatDate(idea.postedAt, locale, { dateStyle: "medium", timeStyle: "short" })} · ${format(t.totalViews, { count: formatNumber(idea.views, locale) })}`
                    : ""}
              </p>
              {idea.error ? <p className="text-xs text-destructive">{errorNote(t, idea.error)}</p> : null}
              <DestinationChips destinations={notPosted} t={t} />
              {props.canEdit ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {files && idea.status !== "posting" ? (
                    <Button size="sm" variant="outline" onClick={() => props.onPublish(idea)}>
                      <Send aria-hidden="true" />
                      {t.flow.posted.publish}
                    </Button>
                  ) : null}
                  {scheduled ? (
                    <Button size="sm" variant="ghost" disabled={props.pending} onClick={() => props.run(() => unscheduleVideoIdea(props.websiteId, idea.id))}>
                      {t.unschedule}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {shown.map((platform) => {
                const state = idea.destinations[platform];
                if (state && state.status !== "posted" && state.status !== "scheduled") return null;
                const stats = idea.stats[platform];
                const url = idea.postedUrls[platform] || state?.url || null;
                return (
                  <div key={platform} className="rounded-xl border px-3 py-2 text-xs">
                    <div className="flex items-center gap-1 font-medium">
                      {platformName(platform)}
                      {state?.status === "scheduled" ? <span className="font-normal text-muted-foreground">· {t.viral.destinations.status.scheduled}</span> : null}
                      {state?.manual ? <span className="font-normal text-muted-foreground">· {t.flow.posted.manual}</span> : null}
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
        );
      })}
    </div>
  );
}
