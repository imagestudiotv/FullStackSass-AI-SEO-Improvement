"use server";

import { headers } from "next/headers";

import { isLocale } from "@/lib/i18n/config";
import { visitorKey } from "@/lib/visitor-key";

import { freeSocialStatus, generateFreeSocialPosts } from "./social-posts";
import {
  isFreeSocialGoal,
  isFreeSocialPlatform,
  isFreeSocialTone,
  MAX_URL_CHARS,
  type FreeSocialOutcome,
  type FreeSocialStatus,
} from "./social-posts-shared";

/**
 * The free AI Social Media Post Generator's two calls from the browser
 * (components/social-post-generator). Who is asking comes from the request,
 * never from the browser's word (lib/visitor-key.ts); the limits are
 * lib/tools/social-posts.ts's. Everything sent is checked here: a server
 * action is a public endpoint.
 */

export async function generateFreeSocialPostsAction(input: {
  url: string;
  platform: string;
  goal: string;
  tone: string;
  hashtags: boolean;
  emoji: boolean;
  locale: string;
}): Promise<FreeSocialOutcome> {
  const url = typeof input?.url === "string" ? input.url.slice(0, MAX_URL_CHARS + 1) : "";
  if (!isFreeSocialPlatform(input?.platform)) return { ok: false, reason: "invalid_url" };
  const visitor = visitorKey(await headers());
  return generateFreeSocialPosts(
    {
      url,
      platform: input.platform,
      goal: isFreeSocialGoal(input?.goal) ? input.goal : "introduce",
      tone: isFreeSocialTone(input?.tone) ? input.tone : "natural",
      hashtags: input?.hashtags !== false,
      emoji: input?.emoji === true,
      locale: isLocale(input?.locale) ? input.locale : "en",
    },
    visitor,
  );
}

/** Whether the free batch is still there, when the tool is first shown. */
export async function freeSocialPostsStatusAction(): Promise<FreeSocialStatus> {
  try {
    return await freeSocialStatus(visitorKey(await headers()));
  } catch {
    // The generate call decides; the page simply offers it.
    return { available: true };
  }
}
