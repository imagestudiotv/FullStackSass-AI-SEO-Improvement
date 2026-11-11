"use server";

import { headers } from "next/headers";

import { getSession } from "@/lib/auth-guard";
import { isUuid, viewerEngagement } from "@/lib/blog/engagement";
import { clientAddress, visitorIdentity } from "@/lib/visitor-key";

import { recordProfileView, upvotesThisWeek } from "./profiles";

/**
 * The customer directory's calls from the browser (lib/discover/profiles.ts),
 * so its pages stay the same for every visitor. Upvoting itself is the blog's
 * own action (lib/blog/engagement-actions.ts togglePostUpvote): one upvote
 * per member and post, wherever it is given.
 */

/** Counts the profile's view once it is open in a browser (robots and repeat visits today are not counted). */
export async function recordDiscoverView(postId: string): Promise<void> {
  if (!isUuid(postId)) return;
  try {
    const request = await headers();
    await recordProfileView({
      postId,
      visitor: visitorIdentity(clientAddress(request)),
      userAgent: request.get("user-agent"),
    });
  } catch (error) {
    // A view that is not counted is never worth an error on the page.
    console.error("[discover] counting a view failed", error);
  }
}

/** Which of the listed businesses the caller has upvoted; nothing when signed out. */
export async function loadDiscoverViewer(postIds: string[]): Promise<{ signedIn: boolean; upvoted: string[] }> {
  const session = await getSession();
  const userId = session?.user?.id ?? null;
  if (!userId) return { signedIn: false, upvoted: [] };
  const ids = (Array.isArray(postIds) ? postIds : []).filter(isUuid).slice(0, 500);
  const marks = await viewerEngagement(userId, ids);
  return { signedIn: true, upvoted: ids.filter((id) => marks[id]?.upvoted) };
}

/** "Upvotes this week" again, after the caller's own upvote changed it. */
export async function loadUpvotesThisWeek(postId: string): Promise<number> {
  return upvotesThisWeek(String(postId));
}
