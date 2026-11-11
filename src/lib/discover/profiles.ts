import "server-only";

import { createHmac } from "node:crypto";

import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { businessWebsite } from "@/lib/blog/business";
import { customerStoriesCategory, isUuid } from "@/lib/blog/engagement";
import { blogLocale, blogPath } from "@/lib/blog/locale";
import { db, isDatabaseConfigured } from "@/lib/db";
import { blogComments, blogPosts, blogPostUpvotes, blogPostViewKeys, blogPostViews } from "@/lib/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

import { isDiscoverSlug, profileParagraphs } from "./profile-fields";

/**
 * The RepGet Customer Showcase (client, 2026-11-11 round 2): /discover lists
 * the businesses growing with RepGet, /discover/<slug> shows one.
 *
 * A business profile IS a published post in the blog's Customer stories
 * category whose Business section has a profile address (blog_posts.
 * business_slug, set in Admin -> Blog). Its upvotes and comments are the
 * post's own (lib/blog/engagement.ts), so they are the same on the profile,
 * on the story's page and in Earn Credits' Discover & earn.
 *
 * LANGUAGES. A translation keeps its original's address (Admin -> Blog
 * copies it), so /it/discover/<slug> is the Italian story's profile. Where a
 * business has no published version in the language, its English one is
 * shown instead - per business, so the Italian directory lists every
 * business, in Italian where it can (the same rule the homepage's stories and
 * Earn Credits apply to a language with no stories at all). Such a page names
 * the English one as its canonical, and only the versions that exist are in
 * the sitemap and the hreflang.
 *
 * VIEWS. Counted from the browser once a person has the profile open
 * (lib/discover/actions.ts): not for requests that say they are robots, and
 * once per visitor, profile and UTC day. The visitor is a keyed hash of the
 * day, the post, the visitor's network address (lib/visitor-key.ts) and the
 * browser string - nothing a person can be identified by is stored - and the
 * keys are deleted after a day. The directory's eye is every view; the
 * profile's "Impressions this week" the last seven days, today included.
 */

/** A week, for "Upvotes this week" and "Impressions this week": the last seven days, today included. */
export const WEEK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const published = eq(blogPosts.status, "published");
const shownComment = and(isNull(blogComments.removedAt), isNull(blogComments.deletedAt));

/** One business as the directory lists it. */
export type DiscoverEntry = {
  postId: string;
  /** The profile's address: /discover/<slug>. */
  slug: string;
  /** The language of the story shown (the visitor's, or English as the fallback). */
  locale: Locale;
  /** The business's name; the post's author when none is given. */
  name: string;
  /** One short line; the post's description when none is given. */
  tagline: string;
  /** The short category the directory filters by (Creative, Business...); null for none. */
  category: string | null;
  logoUrl: string | null;
  /** http(s) only; null when there is none (the design's pending state). */
  websiteUrl: string | null;
  /** Every upvote. */
  upvotes: number;
  /** Shown comments. */
  comments: number;
  /** Every counted view. */
  views: number;
  /** ISO; "Most upvoted" puts the newest first among equals. */
  publishedAt: string;
};

/** One business's page. */
export type DiscoverProfile = DiscoverEntry & {
  tags: string[];
  location: string | null;
  availability: string | null;
  /** Paragraphs; the post's description when the profile has no About. */
  about: string[];
  /** Paragraphs; empty hides the section. */
  audience: string[];
  services: string[];
  /** The business category when no industry is given. */
  industry: string | null;
  /** The story's featured image and its description. */
  imageUrl: string | null;
  imageAlt: string | null;
  /** The post's description, for the page's meta description. */
  description: string;
  /** The customer story itself: "Read the growth case study". */
  storyHref: string;
  /** Upvotes given in the last WEEK_DAYS days. */
  upvotesWeek: number;
  /** Views in the last WEEK_DAYS days. */
  impressionsWeek: number;
  /** The languages with a published version of this profile (hreflang, and whether this one is a fallback). */
  locales: Locale[];
};

/** True for Postgres's "relation/column does not exist", however the driver wraps it. */
function isMissingSchema(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  return code === "42P01" || code === "42703";
}

/** A UTC day as the counter stores it ("2026-11-11"). */
export function viewDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** The first day of the week ending on `now`'s day. */
export function weekStartDay(now: Date): string {
  return viewDay(new Date(now.getTime() - (WEEK_DAYS - 1) * DAY_MS));
}

const columns = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  locale: blogPosts.locale,
  title: blogPosts.title,
  description: blogPosts.description,
  author: blogPosts.author,
  publishedAt: blogPosts.publishedAt,
  featuredImageUrl: blogPosts.featuredImageUrl,
  featuredImageAlt: blogPosts.featuredImageAlt,
  businessLogoUrl: blogPosts.businessLogoUrl,
  businessName: blogPosts.businessName,
  businessCategory: blogPosts.businessCategory,
  businessWebsiteUrl: blogPosts.businessWebsiteUrl,
  businessTagline: blogPosts.businessTagline,
  businessSlug: blogPosts.businessSlug,
  businessTags: blogPosts.businessTags,
  businessLocation: blogPosts.businessLocation,
  businessAvailability: blogPosts.businessAvailability,
  businessAbout: blogPosts.businessAbout,
  businessAudience: blogPosts.businessAudience,
  businessServices: blogPosts.businessServices,
  businessIndustry: blogPosts.businessIndustry,
};

/** The published profiles in the given languages (one slug, or all). */
async function profileRows(locales: Locale[], slug?: string) {
  const category = await customerStoriesCategory();
  if (!category) return [];
  return db
    .select(columns)
    .from(blogPosts)
    .where(
      and(
        published,
        eq(blogPosts.category, category.name),
        isNotNull(blogPosts.businessSlug),
        inArray(blogPosts.locale, locales),
        slug ? eq(blogPosts.businessSlug, slug) : undefined,
      ),
    )
    .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id));
}
type Row = Awaited<ReturnType<typeof profileRows>>[number];

/** Each business once: its version in `locale` where there is one, else its English one. */
function pickVersions(rows: Row[], locale: Locale): Row[] {
  const bySlug = new Map<string, Row>();
  for (const row of rows) {
    const slug = row.businessSlug ?? "";
    if (!isDiscoverSlug(slug)) continue;
    const seen = bySlug.get(slug);
    if (!seen || (seen.locale !== locale && row.locale === locale)) bySlug.set(slug, row);
  }
  return [...bySlug.values()];
}

/** Upvotes, shown comments and views per post. */
async function totals(ids: string[]): Promise<Map<string, { upvotes: number; comments: number; views: number }>> {
  const out = new Map(ids.map((id) => [id, { upvotes: 0, comments: 0, views: 0 }]));
  if (ids.length === 0) return out;
  const [upvotes, comments, views] = await Promise.all([
    db.select({ postId: blogPostUpvotes.postId, n: count() }).from(blogPostUpvotes).where(inArray(blogPostUpvotes.postId, ids)).groupBy(blogPostUpvotes.postId),
    db
      .select({ postId: blogComments.postId, n: count() })
      .from(blogComments)
      .where(and(inArray(blogComments.postId, ids), shownComment))
      .groupBy(blogComments.postId),
    db
      .select({ postId: blogPostViews.postId, n: sql<number>`coalesce(sum(${blogPostViews.views}), 0)::int` })
      .from(blogPostViews)
      .where(inArray(blogPostViews.postId, ids))
      .groupBy(blogPostViews.postId),
  ]);
  for (const row of upvotes) out.get(row.postId)!.upvotes = Number(row.n);
  for (const row of comments) out.get(row.postId)!.comments = Number(row.n);
  for (const row of views) out.get(row.postId)!.views = Number(row.n);
  return out;
}

function entryOf(row: Row, counts: { upvotes: number; comments: number; views: number }): DiscoverEntry {
  return {
    postId: row.id,
    slug: row.businessSlug ?? "",
    locale: blogLocale(row.locale),
    name: row.businessName?.trim() || row.author,
    tagline: row.businessTagline?.trim() || row.description,
    category: row.businessCategory?.trim() || null,
    logoUrl: row.businessLogoUrl || null,
    websiteUrl: row.businessWebsiteUrl ? businessWebsite(row.businessWebsiteUrl) : null,
    ...counts,
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
  };
}

/** "Most upvoted": every upvote, then the newest. */
export function byUpvotes(a: Pick<DiscoverEntry, "upvotes" | "publishedAt">, b: Pick<DiscoverEntry, "upvotes" | "publishedAt">): number {
  return b.upvotes - a.upvotes || b.publishedAt.localeCompare(a.publishedAt);
}

/**
 * The directory in a language: every business with a published profile, in
 * that language where it has one (else English), most upvoted first. Empty
 * with no database, or before migration 0091.
 */
export async function listDiscoverProfiles(locale: Locale): Promise<DiscoverEntry[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = pickVersions(await profileRows(locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE]), locale);
    const counts = await totals(rows.map((row) => row.id));
    return rows.map((row) => entryOf(row, counts.get(row.id)!)).sort(byUpvotes);
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    console.warn("[discover] the profile columns do not exist yet (migration 0091): listing none");
    return [];
  }
}

/** Upvotes given to a post in the last WEEK_DAYS days. */
export async function upvotesThisWeek(postId: string, now: Date = new Date()): Promise<number> {
  if (!isUuid(postId)) return 0;
  const since = new Date(`${weekStartDay(now)}T00:00:00Z`);
  const [row] = await db
    .select({ n: count() })
    .from(blogPostUpvotes)
    .where(and(eq(blogPostUpvotes.postId, postId), gte(blogPostUpvotes.createdAt, since)));
  return Number(row?.n ?? 0);
}

/** Views of a post in the last WEEK_DAYS days. */
export async function impressionsThisWeek(postId: string, now: Date = new Date()): Promise<number> {
  if (!isUuid(postId)) return 0;
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${blogPostViews.views}), 0)::int` })
    .from(blogPostViews)
    .where(and(eq(blogPostViews.postId, postId), gte(blogPostViews.day, weekStartDay(now))));
  return Number(row?.n ?? 0);
}

/**
 * One business's page in a language: its version in that language, else its
 * English one; null when there is neither (an unknown address, a draft, a
 * post outside Customer stories, or one without a profile address).
 */
export async function getDiscoverProfile(locale: Locale, slug: string, now: Date = new Date()): Promise<DiscoverProfile | null> {
  if (!isDiscoverSlug(slug) || !isDatabaseConfigured()) return null;
  let rows: Row[];
  try {
    rows = await profileRows([...LOCALES], slug);
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    return null;
  }
  const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === DEFAULT_LOCALE);
  if (!row) return null;
  const [counts, upvotesWeek, impressionsWeek] = await Promise.all([totals([row.id]), upvotesThisWeek(row.id, now), impressionsThisWeek(row.id, now)]);
  const entry = entryOf(row, counts.get(row.id)!);
  const about = profileParagraphs(row.businessAbout);
  const rowLocale = blogLocale(row.locale);
  return {
    ...entry,
    tags: row.businessTags ?? [],
    location: row.businessLocation?.trim() || null,
    availability: row.businessAvailability?.trim() || null,
    about: about.length > 0 ? about : profileParagraphs(row.description),
    audience: profileParagraphs(row.businessAudience),
    services: row.businessServices ?? [],
    industry: row.businessIndustry?.trim() || entry.category,
    imageUrl: row.featuredImageUrl || null,
    imageAlt: row.featuredImageAlt || null,
    description: row.description,
    storyHref: blogPath(rowLocale, row.slug),
    upvotesWeek,
    impressionsWeek,
    locales: LOCALES.filter((l) => rows.some((r) => r.locale === l)),
  };
}

/** Every published profile in each language it exists in, for the sitemap. */
export async function discoverSitemapProfiles(): Promise<{ locale: Locale; slug: string; updatedAt: Date }[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await profileRows([...LOCALES]);
    return rows
      .filter((row) => isDiscoverSlug(row.businessSlug))
      .map((row) => ({ locale: blogLocale(row.locale), slug: row.businessSlug as string, updatedAt: row.publishedAt ?? new Date() }));
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    return [];
  }
}

/* ------------------------------------------------------------------------- */
/* Views                                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Requests that say they are not a person: crawlers, link previews, speed
 * tests, headless browsers and HTTP libraries. No browser string at all is
 * one too.
 */
const ROBOT =
  /bot\b|bot\/|crawl|spider|slurp|archiver|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl\/|wget|python|java\/|go-http|axios|node-fetch|undici|okhttp|httpclient|scrapy|phantomjs|selenium|puppeteer|playwright/i;

export function isLikelyRobot(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent ?? "").trim();
  return ua.length === 0 || ROBOT.test(ua);
}

/** The keyed hash one visitor is counted as for one post on one day. */
export function viewKey(input: { postId: string; day: string; visitor: string; userAgent: string }, secret: string): string {
  return createHmac("sha256", secret).update(`${input.day}\n${input.postId}\n${input.visitor}\n${input.userAgent}`).digest("hex").slice(0, 40);
}

function viewSecret(): string {
  return process.env.DISCOVER_VIEW_SECRET || process.env.BETTER_AUTH_SECRET || "repget-discover-views";
}

/**
 * Counts one view of a profile: false (and nothing written) for a robot, a
 * post that is not a published profile, or a visitor already counted for it
 * today. `visitor` is who is asking as lib/visitor-key.ts sees them; it is
 * only ever stored hashed.
 */
export async function recordProfileView(input: { postId: string; visitor: string; userAgent: string | null; now?: Date }): Promise<boolean> {
  if (!isUuid(input.postId) || isLikelyRobot(input.userAgent)) return false;
  const now = input.now ?? new Date();
  const [post] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(eq(blogPosts.id, input.postId), published, isNotNull(blogPosts.businessSlug)))
    .limit(1);
  if (!post) return false;
  const day = viewDay(now);
  const key = viewKey({ postId: input.postId, day, visitor: input.visitor, userAgent: String(input.userAgent).slice(0, 300) }, viewSecret());
  return db.transaction(async (tx) => {
    // The unique key decides: of two requests at once, one counts.
    const fresh = await tx.insert(blogPostViewKeys).values({ key, day }).onConflictDoNothing().returning({ id: blogPostViewKeys.id });
    if (fresh.length === 0) return false;
    await tx
      .insert(blogPostViews)
      .values({ postId: input.postId, day, views: 1 })
      .onConflictDoUpdate({ target: [blogPostViews.postId, blogPostViews.day], set: { views: sql`${blogPostViews.views} + 1` } });
    // Yesterday's keys are kept (a visit just after midnight UTC); older ones are no longer needed.
    await tx.delete(blogPostViewKeys).where(lt(blogPostViewKeys.day, viewDay(new Date(now.getTime() - DAY_MS))));
    return true;
  });
}
