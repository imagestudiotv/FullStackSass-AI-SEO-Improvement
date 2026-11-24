"use client";

import { Clapperboard, ExternalLink, Loader2, Send, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { isVideoPlatform } from "@/lib/video/formats";
import { unscheduleVideoIdea } from "@/lib/video/publish-actions";

import { DeleteDialog, SelectBar, SelectBox, useDeletion } from "./delete-videos";
import { EmptyState, platformName, type IdeaView, type OpenPublish, type Run, type T, type Tab } from "./shared";

/**
 * Posted: what is scheduled (with Unschedule), on its way, or out - where
 * each video is and its numbers; LinkedIn and X like the others, posts the
 * customer made by hand (marked in the publishing window) said so. A platform
 * it did not reach is simply not listed: Publish opens the publishing window
 * again, for the ones it is not on yet. Delete takes it off RepGet only.
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
  const { locale, t, onTab } = props;
  const deletion = useDeletion({ websiteId: props.websiteId, ideas: props.posted, t });
  const posted = deletion.left;
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
      {props.canEdit ? (
        <div className="flex justify-end">
          <SelectBar deletion={deletion} shown={posted} t={t} />
        </div>
      ) : null}
      {posted.map((idea) => {
        // Where it is or goes: its destinations (posted, on their way, scheduled) and links; its platforms where neither was kept yet.
        const known = [...new Set([...Object.keys(idea.destinations), ...Object.keys(idea.postedUrls)])];
        const shown = (known.length > 0 ? known : idea.platforms).filter(isVideoPlatform);
        const files = Boolean(idea.videoUrl || idea.slideUrls.length > 0);
        const scheduled = idea.status === "scheduled";
        return (
          <div key={idea.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
            <SelectBox idea={idea} deletion={deletion} t={t} className="shrink-0" />
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
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={format(t.flow.library.remove.buttonFor, { title: idea.title })}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deletion.ask([idea])}
                  >
                    <Trash2 aria-hidden="true" />
                    {t.flow.library.remove.button}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {shown.map((platform) => {
                const state = idea.destinations[platform];
                const stats = idea.stats[platform];
                const url = idea.postedUrls[platform] || state?.url || null;
                return (
                  <div key={platform} className="rounded-xl border px-3 py-2 text-xs">
                    <div className="flex items-center gap-1 font-medium">
                      {platformName(platform)}
                      {state?.status === "posting" ? <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label={t.status.posting} /> : null}
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
      <DeleteDialog deletion={deletion} t={t} />
    </div>
  );
}
