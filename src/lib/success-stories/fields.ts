import { blogSlug } from "@/lib/blog/shared";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * A success story as Admin -> Success stories writes it (client, 2026-11-19;
 * lib/admin/success-stories.ts saves it, lib/success-stories/stories.ts reads
 * it). No server imports: the admin editor (a client component) reads the
 * limits and the address rule too; the server applies them on every save
 * (lib/success-stories/clean.ts).
 */

/** As the editor sends it: every text a string, empty for none. */
export type SuccessStoryInput = {
  name: string;
  websiteUrl: string;
  /** One of the blog's pictures (uploaded here), or empty for the name's initial. */
  logoUrl: string;
  title: string;
  summary: string;
  /** Empty: "Customer story" in the reader's language. */
  categoryLabel: string;
  slug: string;
  /** HTML from the rich-text editor; sanitised on save. */
  bodyHtml: string;
  metrics: StoryMetric[];
  /** A /discover/<slug> profile's address, or empty. */
  discoverSlug: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
};

/** One key figure: "291" over "researched keywords". */
export type StoryMetric = { value: string; label: string };

export const STORY_LIMITS = {
  name: 80,
  title: 140,
  summary: 320,
  categoryLabel: 40,
  slug: 80,
  /** HTML, after sanitising. */
  body: 60_000,
  metrics: 6,
  metricValue: 24,
  metricLabel: 60,
  seoTitle: 70,
  seoDescription: 170,
} as const;

/**
 * Addresses a story cannot take: image-studio is the hand-built case study's
 * (app/(marketing)/success-stories/image-studio), the rest are words a later
 * page under /success-stories might want.
 */
export const RESERVED_STORY_SLUGS: ReadonlySet<string> = new Set(["image-studio", "new", "page", "category", "admin"]);

/** An address from what was typed: lower-case letters, digits and hyphens ("Dumitru Culiuc" -> "dumitru-culiuc"). */
export function storySlug(raw: string): string {
  return blogSlug(String(raw ?? "")).slice(0, STORY_LIMITS.slug).replace(/-+$/, "");
}

/** True for an address as stored (what a /success-stories/<slug> request must look like). */
export function isStorySlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= STORY_LIMITS.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * A story's page in a language: /success-stories/<slug>, /it/success-stories/<slug>.
 * Built here rather than by localePath, which only prefixes the fixed pages
 * (as lib/discover/paths.ts does for the profiles).
 */
export function successStoryPath(locale: Locale, slug: string): string {
  return locale === DEFAULT_LOCALE ? `/success-stories/${slug}` : `/${locale}/success-stories/${slug}`;
}
