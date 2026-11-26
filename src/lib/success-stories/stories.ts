import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { discussionsOf, listCustomerStories, type CustomerStory } from "@/lib/blog/engagement";
import { db, isDatabaseConfigured } from "@/lib/db";
import { blogPosts, successStories } from "@/lib/db/schema";
import { localePath, type Locale } from "@/lib/i18n/config";
import { CASE_STUDY_COPY, CASE_STUDY_PATH, IMAGE_STUDIO } from "@/lib/marketing/case-study-image-studio";

import { isStorySlug, successStoryPath, type StoryMetric } from "./fields";
import { isImageStudioCard, orderStoryCards, type StoryCard } from "./order";

/**
 * The customer stories every page lists (client, 2026-11-19), from three
 * sources, in ONE order (lib/success-stories/order.ts: Image Studio first,
 * always):
 * - Image Studio's case study, built in (lib/marketing/case-study-image-
 *   studio.ts), so it is first even in a language with no post about it;
 * - the blog's Customer stories posts (lib/blog/engagement.ts), as the
 *   homepage listed them before - Dumitru Culiuc's founder story is one;
 * - the stories written in Admin -> Success stories (table success_stories),
 *   each with its own page at /success-stories/<slug>.
 * The homepage shows the first three, /discover and /success-stories more.
 * A business with a story from Admin -> Success stories is listed by that
 * story only (order.ts; client, 2026-11-26): its blog posts stay in the blog.
 */

/** A published story's page, as /success-stories/<slug> draws it. */
export type SuccessStoryPage = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  title: string;
  summary: string;
  categoryLabel: string | null;
  bodyHtml: string;
  metrics: StoryMetric[];
  discoverSlug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** True for Postgres's "relation/column does not exist", however the driver wraps it. */
function isMissingSchema(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  return code === "42P01" || code === "42703";
}

function toPage(row: typeof successStories.$inferSelect): SuccessStoryPage {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.websiteUrl,
    logoUrl: row.logoUrl,
    title: row.title,
    summary: row.summary,
    categoryLabel: row.categoryLabel,
    bodyHtml: row.bodyHtml,
    metrics: row.metrics ?? [],
    discoverSlug: row.discoverSlug,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    published: row.published,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The published stories from Admin -> Success stories, in the admin's order.
 * None without a database (a build without one), or before the table exists
 * (code deployed ahead of its migration): the pages show Image Studio alone
 * rather than failing.
 */
export async function listPublishedSuccessStories(): Promise<SuccessStoryPage[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await db
      .select()
      .from(successStories)
      .where(eq(successStories.published, true))
      .orderBy(asc(successStories.sortOrder), asc(successStories.createdAt));
    return rows.map(toPage);
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    console.warn("[success-stories] the success_stories table does not exist yet: showing none");
    return [];
  }
}

/** One published story by its address; null for a draft, a deleted one or a malformed address. */
export async function getPublishedSuccessStory(slug: string): Promise<SuccessStoryPage | null> {
  if (!isStorySlug(slug) || !isDatabaseConfigured()) return null;
  try {
    const [row] = await db
      .select()
      .from(successStories)
      .where(and(eq(successStories.slug, slug), eq(successStories.published, true)))
      .limit(1);
    return row ? toPage(row) : null;
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    return null;
  }
}

/** Image Studio's card when no post is about it: the case study, in the reader's language. */
export function imageStudioCard(locale: Locale): StoryCard {
  const copy = CASE_STUDY_COPY[locale];
  return {
    id: "image-studio",
    source: "image-studio",
    title: copy.title,
    description: copy.card.summary,
    name: "Image Studio",
    logoUrl: "/images/testimonials/image-studio.webp",
    href: localePath(locale, CASE_STUDY_PATH),
    websiteUrl: IMAGE_STUDIO.site,
    label: null,
    sortOrder: 0,
    addedAt: `${IMAGE_STUDIO.published}T00:00:00.000Z`,
  };
}

export function blogStoryCard(story: CustomerStory): StoryCard {
  return {
    id: `post:${story.postId}`,
    source: "blog",
    title: story.title,
    description: story.description,
    name: story.name,
    logoUrl: story.logoUrl,
    href: story.href,
    websiteUrl: story.websiteUrl,
    label: null,
    // Before every story from Admin -> Success stories (order.ts).
    sortOrder: 0,
    addedAt: story.publishedAt,
  };
}

export function successStoryCard(story: SuccessStoryPage, locale: Locale, sortOrder: number): StoryCard {
  return {
    id: `story:${story.id}`,
    source: "story",
    title: story.title,
    description: story.summary,
    name: story.name,
    logoUrl: story.logoUrl,
    href: successStoryPath(locale, story.slug),
    websiteUrl: story.websiteUrl,
    label: story.categoryLabel,
    // 1, 2, 3... in the admin's order, so every one follows the blog's stories and Image Studio.
    sortOrder,
    addedAt: story.publishedAt?.toISOString() ?? null,
  };
}

/** The business a post names, as stored: each field null when blank. */
type PostBusiness = { name: string | null; websiteUrl: string | null; logoUrl: string | null };

const blank = (value: string | null) => value?.trim() || null;

/**
 * The business each post is about, its blank fields taken from another
 * version of the same article (its discussion: the original and its
 * translations, lib/blog/engagement.ts), the original first. A translation
 * often leaves the business empty - the Spanish post about Image Studio
 * showed "RepGet team", its author - so without this it would not be known
 * as the same business as its original or as that business's success story,
 * and the same story would be listed twice (client, 2026-11-26).
 */
async function discussionBusinesses(postIds: string[]): Promise<Map<string, PostBusiness>> {
  const result = new Map<string, PostBusiness>();
  if (postIds.length === 0 || !isDatabaseConfigured()) return result;
  try {
    const discussions = await discussionsOf(postIds);
    const ids = [...new Set(discussions.values())];
    if (ids.length === 0) return result;
    const rows = await db
      .select({
        id: blogPosts.id,
        discussionId: blogPosts.discussionId,
        translationOf: blogPosts.translationOf,
        name: blogPosts.businessName,
        websiteUrl: blogPosts.businessWebsiteUrl,
        logoUrl: blogPosts.businessLogoUrl,
      })
      .from(blogPosts)
      .where(inArray(blogPosts.discussionId, ids))
      .orderBy(sql`(${blogPosts.translationOf} is null) desc`, asc(blogPosts.createdAt), asc(blogPosts.id));
    for (const [postId, discussionId] of discussions) {
      const own = rows.find((row) => row.id === postId);
      // The post's own fields first, then each other version's, the original first.
      const versions = [...(own ? [own] : []), ...rows.filter((row) => row.discussionId === discussionId && row.id !== postId)];
      const first = (field: keyof PostBusiness) => versions.map((row) => blank(row[field])).find(Boolean) ?? null;
      result.set(postId, { name: first("name"), websiteUrl: first("websiteUrl"), logoUrl: first("logoUrl") });
    }
    return result;
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    return result;
  }
}

/** A post's card fields with its article's business (discussionBusinesses) where the post names none. */
export function withBusiness(story: CustomerStory, business: PostBusiness | undefined): CustomerStory {
  if (!business) return story;
  return {
    ...story,
    name: business.name ?? story.name,
    websiteUrl: business.websiteUrl ?? story.websiteUrl,
    logoUrl: business.logoUrl ?? story.logoUrl,
  };
}

/** At most this many blog stories are read:the directory and /success-stories show every one, and there are a handful. */
const BLOG_STORIES_READ = 100;

/**
 * Every customer story's card in a language, in the one order (order.ts):
 * Image Studio first, then the blog's stories, then Admin -> Success
 * stories'. The homepage takes the first three.
 */
export async function listStoryCards(locale: Locale): Promise<StoryCard[]> {
  const [posts, stories] = await Promise.all([listCustomerStories(locale, BLOG_STORIES_READ), listPublishedSuccessStories()]);
  const businesses = await discussionBusinesses(posts.map((post) => post.postId));
  return orderStoryCards([
    imageStudioCard(locale),
    ...posts.map((post) => blogStoryCard(withBusiness(post, businesses.get(post.postId)))),
    ...stories.map((story, index) => successStoryCard(story, locale, index + 1)),
  ]);
}

/**
 * The stories after Image Studio's, for /success-stories: its hand-built
 * case-study card leads that page (success-stories-content.tsx), whichever
 * card about it the other pages show.
 */
export async function otherStoryCards(locale: Locale): Promise<StoryCard[]> {
  return (await listStoryCards(locale)).filter((card) => !isImageStudioCard(card));
}

/**
 * The Customer stories section's cards (the homepage's and /discover's, built
 * ahead like the rest of their data) and "View all customer stories":
 * /success-stories in the reader's language, which lists every story in this
 * same order. Until 2026-11-19 it went to the blog's category page, which
 * lists the newest first - Image Studio was not first there.
 */
export async function customerStoriesSection(locale: Locale): Promise<{ stories: StoryCard[]; viewAllHref: string }> {
  return { stories: await listStoryCards(locale), viewAllHref: localePath(locale, "/success-stories") };
}
