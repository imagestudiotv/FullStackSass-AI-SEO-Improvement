"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-guard";
import { addComment, BlogEngagementNotFound, discoverProgress, isUuid, listCustomerStories, setPostUpvote } from "@/lib/blog/engagement";
import { resolveAppLocale } from "@/lib/i18n/app-locale";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { claimDiscoverBonus } from "./discover";
import { draftDiscoverComment, type DraftRefusal } from "./discover-draft";
import { commentProblem, DISCOVER_LIMIT, isDiscoverStyle, type CommentProblem, type DiscoverProgress } from "./discover-rules";

/**
 * Discover & earn's buttons on Earn Credits (client ticket, 2026-11-11). Who
 * acts is always the signed-in session; the browser names only the post and
 * the text. The upvote and the comment are the post's own (lib/blog/engagement.ts),
 * so they show on the post's page at once. Every answer carries the member's
 * progress as the server counts it, so the page never shows its own guess.
 */

export type DiscoverActionError = "not_found" | "rate_limited" | "failed";

export type UpvoteResult = { ok: true; progress: DiscoverProgress } | { ok: false; error: DiscoverActionError };

export async function discoverUpvoteAction(postId: string): Promise<UpvoteResult> {
  const session = await requireSession();
  if (!isUuid(postId)) return { ok: false, error: "not_found" };
  try {
    await setPostUpvote(session.user.id, postId, true);
    return { ok: true, progress: await discoverProgress(session.user.id) };
  } catch (error) {
    if (error instanceof BlogEngagementNotFound) return { ok: false, error: "not_found" };
    console.error("[earn/discover] upvote failed", error);
    return { ok: false, error: "failed" };
  }
}

export type CommentResult = { ok: true; progress: DiscoverProgress } | { ok: false; error: CommentProblem | DiscoverActionError };

/** Checked here as in the dialog: 50 to 750 characters, no links, and the member's own confirmation that they reviewed it. */
export async function discoverCommentAction(input: { postId: string; body: string; confirmed: boolean }): Promise<CommentResult> {
  const session = await requireSession();
  const postId = String(input?.postId ?? "");
  const body = typeof input?.body === "string" ? input.body : "";
  const problem = commentProblem(body, input?.confirmed === true);
  if (problem) return { ok: false, error: problem };
  if (!isUuid(postId)) return { ok: false, error: "not_found" };
  try {
    const added = await addComment({ userId: session.user.id, postId, body: body.trim() });
    if (!added.ok) {
      return { ok: false, error: added.reason === "too_long" ? "too_long" : added.reason === "empty" ? "short" : added.reason };
    }
    return { ok: true, progress: await discoverProgress(session.user.id) };
  } catch (error) {
    console.error("[earn/discover] comment failed", error);
    return { ok: false, error: "failed" };
  }
}

export type DraftActionResult = { ok: true; draft: string } | { ok: false; reason: DraftRefusal | "not_found" };

/** One AI draft for a customer story, in the member's language. The story is read here, from its id. */
export async function discoverDraftAction(input: { postId: string; style: string }): Promise<DraftActionResult> {
  const session = await requireSession();
  const style = isDiscoverStyle(input?.style) ? input.style : "question";
  const locale = await resolveAppLocale(session.user.id);
  try {
    const story = (await listCustomerStories(locale, DISCOVER_LIMIT)).find((row) => row.postId === input?.postId);
    if (!story) return { ok: false, reason: "not_found" };
    return await draftDiscoverComment({ userId: session.user.id, story, style, locale });
  } catch (error) {
    console.error("[earn/discover] draft failed", error);
    return { ok: false, reason: "failed" };
  }
}

export type BonusActionResult =
  | { ok: true; credits: number; progress: DiscoverProgress }
  | { ok: false; error: "already_claimed" | "not_reached" | "not_allowed" | "failed"; progress?: DiscoverProgress };

/** The bonus, for the member, into the workspace they are in (requireOrg). Takes no arguments on purpose. */
export async function claimDiscoverBonusAction(): Promise<BonusActionResult> {
  const { orgId, userId } = await requireOrg();
  // Earn Credits is for one's own workspace (the page says so to someone with only shared work).
  if (await hasOnlySharedWork()) return { ok: false, error: "not_allowed" };
  try {
    const claim = await claimDiscoverBonus(userId, orgId);
    if (claim.outcome !== "claimed") return { ok: false, error: claim.outcome, progress: claim.progress };
    // The layout's balance, the Credits page's history, Earn Credits.
    revalidatePath("/", "layout");
    return { ok: true, credits: claim.credits, progress: claim.progress };
  } catch (error) {
    console.error("[earn/discover] bonus claim failed", error);
    return { ok: false, error: "failed" };
  }
}
