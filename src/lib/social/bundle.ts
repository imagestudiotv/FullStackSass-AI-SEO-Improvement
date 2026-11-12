import "server-only";

import type { VideoBundleType } from "@/lib/video/formats";

import type { BundleType } from "./platforms";

/**
 * bundle.social (client, 2026-10-27: paid by the client, "he will take X
 * fees"): the API that connects the customer's Reddit, X, Threads, Pinterest
 * and Bluesky accounts and publishes their OWN posts. Replies are never sent
 * through it (lib/social/platforms.ts).
 *
 * One bundle.social team per website ("one team per brand"), created on the
 * first connection. The customer connects an account on bundle.social's
 * hosted page (a portal link) and comes back to RepGet, which reads the
 * team's accounts.
 *
 * Optional, like every integration here: without BUNDLE_SOCIAL_API_KEY the
 * accounts are usernames and own posts are one-click like replies. The key
 * is read at call time, so a build needs none.
 *
 * Docs: https://info.bundle.social/api-reference (OpenAPI at
 * https://api.bundle.social/swagger-json).
 */

const BASE_URL = "https://api.bundle.social/api/v1";
const TIMEOUT_MS = 30_000;

export function isBundleConfigured(): boolean {
  return Boolean(process.env.BUNDLE_SOCIAL_API_KEY?.trim());
}

export class BundleError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BundleError";
  }
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const key = process.env.BUNDLE_SOCIAL_API_KEY?.trim();
  if (!key) throw new BundleError("bundle.social is not configured (BUNDLE_SOCIAL_API_KEY)");
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "x-api-key": key, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message = (json as { message?: unknown } | null)?.message;
    throw new BundleError(
      `bundle.social ${method} ${path} failed (${response.status})${typeof message === "string" ? `: ${message.slice(0, 300)}` : ""}`,
      response.status,
    );
  }
  return json as T;
}

/** A new team for a website; returns its id. bundle.social wants 3 to 80 characters. */
export async function createTeam(name: string): Promise<string> {
  const safe = name.trim().slice(0, 80);
  const team = await call<{ id: string }>("POST", "/team/", { name: safe.length >= 3 ? safe : "RepGet website" });
  return team.id;
}

/** The hosted page where the customer connects one platform's account; returns its URL. */
export async function portalLink(input: {
  teamId: string;
  type: BundleType | VideoBundleType;
  redirectUrl: string;
  language: string;
  userName?: string;
  /**
   * Instagram only: "FACEBOOK" connects it through Facebook Login (a
   * professional account linked to a Facebook Page), which Instagram's audio
   * API needs; "INSTAGRAM" is Instagram's own login. bundle.social's default
   * applies when left out.
   */
  instagramConnectionMethod?: "FACEBOOK" | "INSTAGRAM";
}): Promise<string> {
  const languages = ["en", "fr", "de", "es", "it"];
  const link = await call<{ url: string }>("POST", "/social-account/create-portal-link", {
    teamId: input.teamId,
    socialAccountTypes: [input.type],
    redirectUrl: input.redirectUrl,
    language: languages.includes(input.language) ? input.language : "en",
    expiresIn: 60,
    hidePoweredBy: true,
    maxSocialAccountsConnected: 1,
    ...(input.userName ? { userName: input.userName.slice(0, 80) } : {}),
    ...(input.instagramConnectionMethod ? { instagramConnectionMethod: input.instagramConnectionMethod } : {}),
  });
  return link.url;
}

export type BundleAccount = {
  id: string;
  type: string;
  username: string | null;
  displayName: string | null;
  /** Pinterest boards, among others. */
  channels: { id: string; name: string | null }[];
  /**
   * The selected publishing target (a LinkedIn profile or organization, a
   * Facebook Page...): empty until a channel is chosen on bundle.social's page,
   * and posting fails without it.
   */
  externalId: string | null;
  /** The person who connected it (a LinkedIn member's id, for one). */
  userId: string | null;
  /** Instagram: connected through Facebook Login ("FACEBOOK") or Instagram's own ("INSTAGRAM"). */
  instagramConnectionMethod: "FACEBOOK" | "INSTAGRAM" | null;
  /** X: the account's subscription (none | basic | premium | premium_plus), which sets its text and video limits. */
  twitterSubType: string | null;
};

/** The accounts connected to a team, without the ones bundle.social has deleted. */
export async function teamAccounts(teamId: string): Promise<BundleAccount[]> {
  type Raw = {
    id: string;
    type: string;
    username?: string | null;
    displayName?: string | null;
    deletedAt?: string | null;
    channels?: { id: string; name?: string | null }[] | null;
    externalId?: string | null;
    userId?: string | null;
    instagramConnectionMethod?: string | null;
    twitterSubType?: string | null;
  };
  const team = await call<{ socialAccounts?: Raw[] | null }>("GET", `/team/${encodeURIComponent(teamId)}`);
  return (team.socialAccounts ?? [])
    .filter((account) => !account.deletedAt)
    .map((account) => ({
      id: account.id,
      type: account.type,
      username: account.username ?? null,
      displayName: account.displayName ?? null,
      channels: (account.channels ?? []).map((channel) => ({ id: channel.id, name: channel.name ?? null })),
      externalId: account.externalId || null,
      userId: account.userId || null,
      instagramConnectionMethod:
        account.instagramConnectionMethod === "FACEBOOK" || account.instagramConnectionMethod === "INSTAGRAM" ? account.instagramConnectionMethod : null,
      twitterSubType: account.twitterSubType ?? null,
    }));
}

export async function disconnectAccount(teamId: string, type: BundleType | VideoBundleType): Promise<void> {
  await call("DELETE", "/social-account/disconnect", { teamId, type });
}

/** Adds a public image to the team's media library; returns the upload's id. */
export async function uploadFromUrl(teamId: string, url: string): Promise<string> {
  const upload = await call<{ id: string }>("POST", "/upload/from-url", { teamId, url });
  return upload.id;
}

export type BundlePostStatus = "DRAFT" | "SCHEDULED" | "POSTED" | "ERROR" | "DELETED" | "PROCESSING" | "REVIEW" | "RETRYING";

export type BundlePost = {
  id: string;
  status: BundlePostStatus;
  error: string | null;
  errors: Record<string, string> | null;
  /** Per platform: the refusal in detail, when bundle.social gives it (retryability says whether trying again can help). */
  errorsVerbose?: Record<string, { code?: string | null; errorMessage?: string | null; retryability?: "retryable" | "non_retryable" | "unknown" | null; userFacingMessage?: string | null } | null> | null;
  /** Per platform: the published post's id and link. */
  externalData: Record<string, { id?: string | null; permalink?: string | null } | null> | null;
};

/**
 * Publishes one own post now. `referenceKey` is RepGet's suggestion id, so a
 * post can be traced back. Returns bundle.social's post.
 */
export async function createPost(input: {
  teamId: string;
  type: BundleType | VideoBundleType;
  data: Record<string, unknown>;
  title: string;
  referenceKey: string;
  now?: Date;
}): Promise<BundlePost> {
  return call<BundlePost>("POST", "/post/", {
    teamId: input.teamId,
    title: input.title.slice(0, 200) || "RepGet post",
    postDate: (input.now ?? new Date()).toISOString(),
    status: "SCHEDULED",
    socialAccountTypes: [input.type],
    data: { [input.type]: input.data },
    referenceKey: input.referenceKey.slice(0, 128),
  });
}

export async function getPost(id: string): Promise<BundlePost> {
  return call<BundlePost>("GET", `/post/${encodeURIComponent(id)}`);
}

/**
 * Publishes one post to several platforms at once (videos: the same reel to
 * Instagram, TikTok, YouTube, Facebook and Pinterest), each with its own settings in
 * `data`. bundle.social reports each platform's result separately.
 */
export async function createMultiPost(input: {
  teamId: string;
  data: Partial<Record<string, Record<string, unknown>>>;
  title: string;
  referenceKey: string;
  now?: Date;
}): Promise<BundlePost> {
  const types = Object.keys(input.data);
  return call<BundlePost>("POST", "/post/", {
    teamId: input.teamId,
    title: input.title.slice(0, 200) || "RepGet video",
    postDate: (input.now ?? new Date()).toISOString(),
    status: "SCHEDULED",
    socialAccountTypes: types,
    data: input.data,
    referenceKey: input.referenceKey.slice(0, 128),
  });
}

/** What the connected TikTok account accepts: TikTok refuses a post whose privacy or interactions it does not allow. */
export async function tiktokPostSettings(teamId: string): Promise<{
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number | null;
}> {
  return call("GET", `/misc/tiktok/post-settings?teamId=${encodeURIComponent(teamId)}`);
}

export type PostStats = { views: number; likes: number; comments: number; shares: number };

/** A published post's latest numbers on one platform, or null before the platform has any. */
export async function postStats(postId: string, type: string): Promise<PostStats | null> {
  const result = await call<{ items?: { views?: number; impressions?: number; likes?: number; comments?: number; shares?: number; createdAt?: string | null }[] | null }>(
    "GET",
    `/analytics/post?postId=${encodeURIComponent(postId)}&platformType=${encodeURIComponent(type)}`,
  );
  const items = [...(result.items ?? [])].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const latest = items[0];
  if (!latest) return null;
  return {
    views: Math.max(latest.views ?? 0, latest.impressions ?? 0),
    likes: latest.likes ?? 0,
    comments: latest.comments ?? 0,
    shares: latest.shares ?? 0,
  };
}

export type InstagramAudio = {
  audioId: string;
  title: string;
  artist: string | null;
  durationMs: number | null;
  coverUrl: string | null;
  previewUrl: string | null;
};

/**
 * Instagram's own music for Reels (Meta's Instagram audio API, through
 * bundle.social): only for an Instagram account connected through Facebook
 * Login - an account connected with Instagram's own login gets a 400.
 * `GET /misc/instagram/audio?teamId&audioType=music&searchQuery`
 * (https://info.bundle.social/api-reference/platforms/instagram-music.md).
 * The answer has no trending flag: nothing found here is called trending.
 */
export async function instagramAudio(teamId: string, query: string): Promise<InstagramAudio[]> {
  const params = new URLSearchParams({ teamId, audioType: "music" });
  const search = query.trim().slice(0, 100);
  if (search) params.set("searchQuery", search);
  type Raw = {
    audio_id?: string | number | null;
    title?: string | null;
    display_artist?: string | null;
    duration_in_ms?: number | null;
    cover_artwork_thumbnail_url?: string | null;
    download_url?: string | null;
  };
  const result = await call<{ audio?: Raw[] | null }>("GET", `/misc/instagram/audio?${params.toString()}`);
  return (result.audio ?? []).flatMap((item) =>
    item.audio_id === null || item.audio_id === undefined || item.audio_id === ""
      ? []
      : [
          {
            audioId: String(item.audio_id),
            title: item.title?.trim() || "Untitled",
            artist: item.display_artist?.trim() || null,
            durationMs: typeof item.duration_in_ms === "number" ? item.duration_in_ms : null,
            coverUrl: item.cover_artwork_thumbnail_url ?? null,
            previewUrl: item.download_url ?? null,
          },
        ],
  );
}
