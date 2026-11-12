"use client";

import { X } from "lucide-react";
import { toast } from "sonner";

import { BrandIcon } from "@/components/brand-icons";
import { format } from "@/lib/i18n/format";
import type { VideosCopy } from "@/lib/i18n/videos";
import { prepareVideoUpload, type VideoResult } from "@/lib/video/actions";
import {
  isVideoPlatform,
  VIDEO_PLATFORM_SPECS,
  type CreativeDirection,
  type DestinationState,
  type FactClaim,
  type IdeaCategory,
  type IdeaOverrides,
  type NativeAudioSelection,
  type ProductionChoices,
  type ReelProps,
  type VideoPlatform,
} from "@/lib/video/formats";

import type { VideoPublishingStatus } from "./_pending";

/** The Social Content page's shared pieces: the idea's view, the error words, the small parts every tab uses. */

export type T = VideosCopy;
export type Tab = "ideas" | "videos" | "posted" | "settings";

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
  /* Viral social content (2026-11-12). */
  category: IdeaCategory;
  direction: CreativeDirection;
  /** Viral: why it could perform well (never a promise), and its technique tags. */
  why: string | null;
  techniques: string[];
  /** The idea's own choices, or the ones derived from its voice/music/captions for older ideas. */
  production: ProductionChoices;
  overrides: IdeaOverrides;
  reviewStatus: string;
  reviewReasons: string[];
  claims: FactClaim[];
  /** Whether the review still holds back automatic posting (it never blocks a manual make or publish). */
  reviewBlocks: boolean;
  destinations: Record<string, DestinationState>;
  nativeAudio: NativeAudioSelection | null;
};

export type VideoAccountView = {
  platform: string;
  username: string;
  connected: boolean;
  pausedReason: string | null;
  /** Pinterest's board (social_accounts.target, chosen on Opportunities); null for the others. */
  board: string | null;
};
export type MediaView = { id: string; url: string; kind: "image" | "video"; name: string | null };
export type TrackView = { id: string; title: string; mood: string };
/** What every action on this page answers: VideoResult (actions.ts) and PublishResult (publish-actions.ts) both fit. */
export type ActionResult<D = unknown> = { ok: true; data: D } | { ok: false; error: string; available?: number; price?: number };
export type Run = (action: () => Promise<ActionResult>, success?: string, after?: () => void) => void;

export const platformName = (platform: string) => (isVideoPlatform(platform) ? VIDEO_PLATFORM_SPECS[platform].name : platform);
/** Where Pinterest's board is chosen: Opportunities, the social page. */
export const opportunitiesHref = (websiteId: string) => `/websites/${websiteId}/social`;
/** The dropdowns here sit beside h-9 buttons. */
export const selectClass = "data-[size=default]:h-9";

/** The error words: the original codes, and the ones the viral content work added (t.viral.errors). */
const errorWords = (t: T): Record<string, string | undefined> => ({ ...t.viral.errors, ...t.errors });

/** An action's error in the reader's language; a code this copy does not know yet reads as the generic one. */
export function errorText(t: T, result: { ok: false; error: string; available?: number }, price: string): string {
  if (result.error === "not_enough_credits") return format(t.errors.not_enough_credits, { price, available: String(result.available ?? 0) });
  return errorWords(t)[result.error] ?? t.errors.generic;
}

/**
 * A video's stored error in the reader's language: the codes publishing
 * leaves (no_accounts, no_board, x_budget...: lib/video/publish.ts)
 * translated, a platform's own refusal as it came.
 */
export function errorNote(t: T, error: string): string {
  return error
    .split(" · ")
    .map((part) => errorWords(t)[part] ?? part)
    .join(" · ");
}
export const isCode = (t: T, error: string | null) => Boolean(error && error.split(" · ").some((part) => part in errorWords(t)));

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-16 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function MediaThumb({ url, kind, onRemove, removeLabel }: { url: string; kind: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <div className="relative size-16 overflow-hidden rounded-lg border bg-muted">
      {kind === "video" ? (
        <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      )}
      {onRemove ? (
        <button type="button" aria-label={removeLabel} onClick={onRemove} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white">
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function PlatformDots({ platforms }: { platforms: VideoPlatform[] }) {
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

const DESTINATION_TONE: Record<string, string> = {
  posted: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  failed: "border-destructive/30 bg-destructive/5 text-destructive",
  skipped: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
};

/** Where a video went, platform by platform: posted, failed or skipped, with the reason in words. */
export function DestinationChips({ destinations, postedUrls, t }: { destinations: Record<string, DestinationState>; postedUrls?: Record<string, string>; t: T }) {
  const entries = Object.entries(destinations).filter(([platform]) => isVideoPlatform(platform));
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t.viral.destinations.label}>
      {entries.map(([platform, state]) => {
        const url = state.url ?? postedUrls?.[platform] ?? null;
        const words = t.viral.destinations.status[state.status as keyof T["viral"]["destinations"]["status"]] ?? state.status;
        return (
          <li
            key={platform}
            className={`flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${DESTINATION_TONE[state.status] ?? "bg-muted/40 text-muted-foreground"}`}
          >
            <BrandIcon name={platform as VideoPlatform} className="size-3 shrink-0" />
            <span className="font-medium">{platformName(platform)}</span>
            <span>· {words}</span>
            {state.error && state.status !== "posted" ? <span className="min-w-0 break-words opacity-90">· {errorNote(t, state.error)}</span> : null}
            {url && state.status === "posted" ? (
              <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {t.open}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export async function upload(websiteId: string, file: File): Promise<VideoResult<{ url: string; kind: "image" | "video" }>> {
  const prepared = await prepareVideoUpload(websiteId, { type: file.type, size: file.size });
  if (!prepared.ok) return prepared;
  const response = await fetch(prepared.data.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!response.ok) return { ok: false, error: "bad_file" };
  return { ok: true, data: { url: prepared.data.publicUrl, kind: prepared.data.kind } };
}

/** Runs an action whose success message needs its result. */
export function startWith<D>(run: Run, action: () => Promise<ActionResult<D>>, success: (data: D) => string, after?: () => void) {
  let message = "";
  run(
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

/** Why X is closed: not set up for videos, or its spending limit reached for now. */
export function xWords(t: T, publishing: VideoPublishingStatus): string {
  return publishing.x.reason === "limit_reached" ? t.viral.x.budget : t.viral.x.needsSetup;
}
