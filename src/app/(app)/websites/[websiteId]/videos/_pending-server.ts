import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import type { VideoResult } from "@/lib/video/actions";

import type { VideoPublishingStatus } from "./_pending";

/**
 * TODO(viral-integration): the server-only stand-in for Worker D's status
 * reader. Replaced by the import named below, and this file deleted.
 * (Worker A's readers were swapped for their real modules on 2026-11-12.)
 */

/**
 * Real: `videoPublishingStatus(websiteId)` from "@/lib/video/publish-actions"
 * (feature/viral-publishing). Until then X is never offered and Instagram's
 * own audio reads as not set up; LinkedIn's connection is read as it is.
 */
export async function videoPublishingStatus(websiteId: string): Promise<VideoResult<VideoPublishingStatus>> {
  const [linkedin] = await db
    .select({ bundle: socialAccounts.bundleAccountId, target: socialAccounts.target })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "linkedin")));
  return {
    ok: true,
    data: {
      x: { available: false, reason: "disabled" },
      instagramAudio: { available: false, reason: "not_configured" },
      linkedin: { connected: Boolean(linkedin?.bundle), target: linkedin?.bundle ? (linkedin.target ?? null) : null },
    },
  };
}
