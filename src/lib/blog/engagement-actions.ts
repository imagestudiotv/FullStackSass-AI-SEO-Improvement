"use server";

import { getSession } from "@/lib/auth-guard";
import {
  addComment,
  BlogEngagementNotFound,
  deleteOwnComment,
  postEngagement,
  setCommentUpvote,
  setPostUpvote,
  type AddCommentResult,
  type PostEngagement,
} from "@/lib/blog/engagement";

/**
 * The blog post page's comments and upvotes (components/blog-engagement),
 * called from the browser so the post's page itself stays the same for
 * every visitor. Every action reads the caller from their session: a
 * signed-out caller gets "signed_out" and nothing is written.
 */

export type EngagementError = "signed_out" | "not_found";
export type EngagementResult<T> = { ok: true; data: T } | { ok: false; error: EngagementError };

async function viewerId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

async function guard<T>(run: () => Promise<T>): Promise<EngagementResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof BlogEngagementNotFound) return { ok: false, error: "not_found" };
    throw error;
  }
}

/** The post's upvotes and comments, with the caller's own state when signed in. */
export async function loadPostEngagement(postId: string): Promise<EngagementResult<PostEngagement>> {
  const id = await viewerId();
  return guard(() => postEngagement(String(postId), id));
}

export async function togglePostUpvote(postId: string, on: boolean): Promise<EngagementResult<{ upvoted: boolean; count: number }>> {
  const id = await viewerId();
  if (!id) return { ok: false, error: "signed_out" };
  return guard(() => setPostUpvote(id, String(postId), on === true));
}

export async function toggleCommentUpvote(commentId: string, on: boolean): Promise<EngagementResult<{ upvoted: boolean; count: number }>> {
  const id = await viewerId();
  if (!id) return { ok: false, error: "signed_out" };
  return guard(() => setCommentUpvote(id, String(commentId), on === true));
}

/** Posts a comment; on success returns the post's fresh state, the new comment first. */
export async function postComment(
  postId: string,
  body: string,
): Promise<{ ok: true; data: PostEngagement } | { ok: false; error: EngagementError | Exclude<AddCommentResult, { ok: true }>["reason"] }> {
  const id = await viewerId();
  if (!id) return { ok: false, error: "signed_out" };
  const added = await addComment({ userId: id, postId: String(postId), body: String(body ?? "") });
  if (!added.ok) return { ok: false, error: added.reason };
  return guard(() => postEngagement(String(postId), id));
}

/** Deletes one of the caller's own comments. */
export async function deleteMyComment(commentId: string): Promise<EngagementResult<null>> {
  const id = await viewerId();
  if (!id) return { ok: false, error: "signed_out" };
  return (await deleteOwnComment(id, String(commentId))) ? { ok: true, data: null } : { ok: false, error: "not_found" };
}
