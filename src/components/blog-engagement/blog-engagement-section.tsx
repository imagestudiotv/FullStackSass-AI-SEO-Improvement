import "server-only";

import type { ReactNode } from "react";

import { blogPath } from "@/lib/blog/locale";
import { postEngagement, type PostEngagement } from "@/lib/blog/engagement";
import type { BlogPost } from "@/lib/blog/shared";
import { COMMENTS_COPY } from "@/lib/i18n/blog-engagement";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

import { BlogEngagement } from "./blog-engagement";

/**
 * A post's comments and upvote, with the public state read on the server
 * (no viewer, no cookies: the page stays the same for every reader); the
 * reader's own state is fetched by the browser (blog-engagement.tsx). A
 * failed read shows the section empty rather than failing the article.
 *
 * Awaited by the post's page and passed in as an element (not an async
 * component), so the page still renders in one pass.
 */
export async function blogEngagementFor(post: BlogPost): Promise<ReactNode> {
  if (!post.id) return null;
  const locale = post.locale ?? DEFAULT_LOCALE;
  let initial: PostEngagement | null = null;
  try {
    initial = await postEngagement(post.id, null);
  } catch (error) {
    console.error("[blog/engagement] reading the post's comments failed", error);
  }
  return <BlogEngagement postId={post.id} locale={locale} copy={COMMENTS_COPY[locale]} path={blogPath(locale, post.slug)} initial={initial} />;
}
