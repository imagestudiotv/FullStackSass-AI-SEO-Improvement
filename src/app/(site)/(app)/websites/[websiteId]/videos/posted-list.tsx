"use client";

import { Clapperboard, ExternalLink, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";

import { DestinationChips, EmptyState, errorNote, platformName, type IdeaView, type T, type Tab } from "./shared";

/** Posted: where each video is and its numbers; LinkedIn and X like the others, and any destination that failed or was skipped. */
export function PostedList({ posted, locale, t, onTab }: { posted: IdeaView[]; locale: Locale; t: T; onTab: (tab: Tab) => void }) {
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
        const notPosted = Object.fromEntries(Object.entries(idea.destinations).filter(([, state]) => state.status !== "posted"));
        return (
          <div key={idea.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{idea.title}</p>
              <p className="text-sm text-muted-foreground">
                {idea.postedAt ? formatDate(idea.postedAt, locale, { dateStyle: "medium", timeStyle: "short" }) : ""} ·{" "}
                {format(t.totalViews, { count: formatNumber(idea.views, locale) })}
              </p>
              {idea.error ? <p className="text-xs text-destructive">{errorNote(t, idea.error)}</p> : null}
              <DestinationChips destinations={notPosted} t={t} />
            </div>
            <div className="flex flex-wrap gap-2">
              {idea.platforms.map((platform) => {
                const stats = idea.stats[platform];
                const url = idea.postedUrls[platform] ?? idea.destinations[platform]?.url ?? null;
                if (idea.destinations[platform] && idea.destinations[platform].status !== "posted") return null;
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
        );
      })}
    </div>
  );
}
