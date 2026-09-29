import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { isBlogCategory, readingMinutes, type BlogCategory, type BlogPost } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

/**
 * The public blog's reads: PUBLISHED posts only. Drafts and unpublished posts
 * exist only in the admin panel (lib/admin/blog.ts); a draft's slug must not
 * answer at /blog/<slug>, or an unfinished post is one guessed URL away.
 *
 * The pages that call these render per request (like the homepage, which
 * reads live prices), so a post published or changed in the admin panel is
 * live at once and a build never needs the database.
 */

type Row = typeof blogPosts.$inferSelect;

/** A date as the blog shows it: the UTC calendar day. */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A stored post in the shape the pages render. */
export function toBlogPost(row: Row & { publishedAt: Date }): BlogPost {
  const post: BlogPost = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: (isBlogCategory(row.category) ? row.category : "Guides") as BlogCategory,
    publishedAt: day(row.publishedAt),
    // Only a revision on a later day reads as an update.
    updatedAt: row.revisedAt && day(row.revisedAt) > day(row.publishedAt) ? day(row.revisedAt) : undefined,
    author: row.author,
    readingMinutes: 0,
    shortAnswer: row.shortAnswer ?? undefined,
    faqs: row.faqs.length > 0 ? row.faqs : undefined,
    sources: row.sources.length > 0 ? row.sources : undefined,
    body: row.bodyHtml,
  };
  post.readingMinutes = readingMinutes(post);
  return post;
}

const published = eq(blogPosts.status, "published");

/** Every published post, newest first. */
export async function listPosts(): Promise<BlogPost[]> {
  const rows = await db.select().from(blogPosts).where(published).orderBy(desc(blogPosts.publishedAt));
  return rows.filter((row): row is Row & { publishedAt: Date } => row.publishedAt !== null).map(toBlogPost);
}

/** One published post by slug, or null. */
export async function getPost(slug: string): Promise<BlogPost | null> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(published, eq(blogPosts.slug, slug)))
    .limit(1);
  return row?.publishedAt ? toBlogPost({ ...row, publishedAt: row.publishedAt }) : null;
}

/** Published posts in one category, newest first. */
export async function postsByCategory(category: BlogCategory): Promise<BlogPost[]> {
  return (await listPosts()).filter((post) => post.category === category);
}

/**
 * Posts to read next, excluding the current one.
 *
 * Deliberately simple: the newest others, same category first - someone
 * reading a playbook wants the next playbook - then anything else, so the
 * section is never short on a small blog.
 */
export async function relatedPosts(current: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await listPosts()).filter((post) => post.slug !== current.slug);
  return [
    ...others.filter((post) => post.category === current.category),
    ...others.filter((post) => post.category !== current.category),
  ].slice(0, limit);
}
