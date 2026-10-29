import "server-only";

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
  type: BundleType;
  redirectUrl: string;
  language: string;
  userName?: string;
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
    }));
}

export async function disconnectAccount(teamId: string, type: BundleType): Promise<void> {
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
  /** Per platform: the published post's id and link. */
  externalData: Record<string, { id?: string | null; permalink?: string | null } | null> | null;
};

/**
 * Publishes one own post now. `referenceKey` is RepGet's suggestion id, so a
 * post can be traced back. Returns bundle.social's post.
 */
export async function createPost(input: {
  teamId: string;
  type: BundleType;
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
