import "server-only";

import { eq } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { discoverProgress, listCustomerStories, viewerEngagement, type CustomerStory } from "@/lib/blog/engagement";
import { db } from "@/lib/db";
import { creditLedger } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";

import { DISCOVER_GOAL, DISCOVER_LIMIT, discoverGoalReached, type DiscoverProgress } from "./discover-rules";

/**
 * Discover & earn's bonus (client ticket, 2026-11-11; the design's developer
 * notes): "Issue one 20-credit bonus when a member has 20 distinct qualifying
 * upvotes and 10 approved comments; ensure one-time, server-side atomic
 * credit issuance."
 *
 * ONE PER MEMBER, EVER: the ledger row's idempotency key names the user, not
 * the workspace, and the ledger's unique index on it decides - of any number
 * of simultaneous claims one inserts and the rest find its row. The credits go
 * to the workspace the member claims from, as every credit does. The counts
 * are read again on the server at the claim (lib/blog/engagement.ts): a
 * comment an administrator removed, or an upvote taken back, no longer counts.
 */

export function discoverBonusKey(userId: string): string {
  return `discover-bonus:${userId}`;
}

/** Whether this member has had the bonus (in any workspace). */
export async function isDiscoverBonusClaimed(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(eq(creditLedger.idempotencyKey, discoverBonusKey(userId)))
    .limit(1);
  return Boolean(row);
}

export type DiscoverBonusClaim =
  | { outcome: "claimed"; credits: number; progress: DiscoverProgress }
  | { outcome: "already_claimed"; progress: DiscoverProgress }
  | { outcome: "not_reached"; progress: DiscoverProgress };

/**
 * The claim button. `userId` and `organizationId` are the signed-in session's
 * (lib/earn/discover-actions.ts), never values a browser sent. Throws if the
 * ledger cannot be reached, so a claim is never reported as done without a row.
 */
export async function claimDiscoverBonus(userId: string, organizationId: string): Promise<DiscoverBonusClaim> {
  const progress = await discoverProgress(userId);
  if (await isDiscoverBonusClaimed(userId)) return { outcome: "already_claimed", progress };
  if (!discoverGoalReached(progress)) return { outcome: "not_reached", progress };

  const inserted = await recordCredit(organizationId, {
    type: "reward",
    amount: DISCOVER_GOAL.bonus,
    referenceId: userId,
    idempotencyKey: discoverBonusKey(userId),
    note: `Discover & earn bonus: ${DISCOVER_GOAL.upvotes} upvotes and ${DISCOVER_GOAL.comments} comments`,
  });
  return inserted ? { outcome: "claimed", credits: DISCOVER_GOAL.bonus, progress } : { outcome: "already_claimed", progress };
}

export type DiscoverItem = Pick<CustomerStory, "postId" | "name" | "category" | "tagline" | "websiteUrl" | "imageUrl" | "logoUrl"> & {
  upvoted: boolean;
  commented: boolean;
};

export type DiscoverState = {
  businesses: DiscoverItem[];
  progress: DiscoverProgress;
  claimed: boolean;
};

/** What the Earn Credits page shows: the stories in the member's language (English when it has none), with the member's own marks. */
export async function loadDiscover(userId: string, locale: Locale): Promise<DiscoverState> {
  const stories = await listCustomerStories(locale, DISCOVER_LIMIT);
  const [marks, progress, claimed] = await Promise.all([
    viewerEngagement(
      userId,
      stories.map((story) => story.postId),
    ),
    discoverProgress(userId),
    isDiscoverBonusClaimed(userId),
  ]);
  return {
    businesses: stories.map((story) => ({
      postId: story.postId,
      name: story.name,
      category: story.category,
      tagline: story.tagline,
      websiteUrl: safeWebsite(story.websiteUrl),
      imageUrl: story.imageUrl,
      logoUrl: story.logoUrl,
      upvoted: marks[story.postId]?.upvoted ?? false,
      commented: marks[story.postId]?.commented ?? false,
    })),
    progress,
    claimed,
  };
}

/** "Visit site" only for an http(s) address: never a javascript: link from a stored field. */
function safeWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
