import "server-only";

import { sanitizeHtml } from "@/lib/articles/sanitize";
import { businessWebsite } from "@/lib/blog/business";
import { isBlogImageUrl } from "@/lib/blog/image-files";
import { blogSiteHosts } from "@/lib/blog/site-hosts";
import { isDiscoverSlug } from "@/lib/discover/profile-fields";

import { isStorySlug, RESERVED_STORY_SLUGS, STORY_LIMITS, storySlug, type StoryMetric, type SuccessStoryInput } from "./fields";

/**
 * A success story's fields as stored, from what Admin -> Success stories sent
 * (lib/admin/success-stories.ts). Refused rather than cut: a summary trimmed
 * mid-sentence on the homepage reads worse than being asked to shorten it.
 * Kept out of the "use server" module, which may export only actions, so the
 * rules are testable on their own.
 */

export class SuccessStoryError extends Error {}

export type CleanSuccessStory = {
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
};

/** A one-line field: trimmed, inner runs of spaces made one. */
function oneLine(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function within(value: string, max: number, label: string): string {
  if (value.length > max) throw new SuccessStoryError(`Keep the ${label} under ${max} characters (it is ${value.length})`);
  return value;
}

/** Pictures shipped with the site (public/images), e.g. Image Studio's. */
const LOCAL_PICTURE = /^\/images\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:webp|png|jpe?g)$/;

export function cleanSuccessStory(input: SuccessStoryInput): CleanSuccessStory {
  const value = (input !== null && typeof input === "object" ? input : {}) as Partial<SuccessStoryInput>;

  const name = within(oneLine(value.name), STORY_LIMITS.name, "name");
  if (!name) throw new SuccessStoryError("Add the business's or person's name");
  const title = within(oneLine(value.title), STORY_LIMITS.title, "title");
  if (!title) throw new SuccessStoryError("Add the story's title");
  const summary = within(oneLine(value.summary), STORY_LIMITS.summary, "summary");
  if (!summary) throw new SuccessStoryError("Add the short summary the card shows");
  const categoryLabel = within(oneLine(value.categoryLabel), STORY_LIMITS.categoryLabel, "category label") || null;

  // Typed or left empty: from the name, as the editor shows it.
  const slug = storySlug(oneLine(value.slug) || name);
  if (!isStorySlug(slug)) throw new SuccessStoryError("Give the story an address: letters, digits and hyphens");
  if (RESERVED_STORY_SLUGS.has(slug)) throw new SuccessStoryError(`"${slug}" is taken by another page - choose another address`);

  const rawWebsite = oneLine(value.websiteUrl);
  const websiteUrl = rawWebsite ? businessWebsite(rawWebsite) : null;
  if (rawWebsite && !websiteUrl) {
    throw new SuccessStoryError(`"${rawWebsite.slice(0, 60)}" is not a website address - use a full address starting with https://`);
  }

  const logo = oneLine(value.logoUrl);
  // An uploaded picture lands among the blog's (the only stored pictures the site's image optimiser serves).
  if (logo && !isBlogImageUrl(logo) && !LOCAL_PICTURE.test(logo)) {
    throw new SuccessStoryError("That picture is not one uploaded here - upload it again");
  }

  const bodyHtml = sanitizeHtml(String(value.bodyHtml ?? ""), { siteHosts: blogSiteHosts() }).trim();
  if (bodyHtml.length > STORY_LIMITS.body) throw new SuccessStoryError("The story is too long - split it or shorten it");

  const rawMetrics = Array.isArray(value.metrics) ? value.metrics : [];
  const metrics: StoryMetric[] = [];
  for (const metric of rawMetrics) {
    const figure = oneLine((metric as Partial<StoryMetric> | null)?.value);
    const label = oneLine((metric as Partial<StoryMetric> | null)?.label);
    // A row left completely empty in the editor is not a figure.
    if (!figure && !label) continue;
    if (!figure || !label) throw new SuccessStoryError("Each key figure needs both a value and a label - or remove it");
    metrics.push({ value: within(figure, STORY_LIMITS.metricValue, "figure's value"), label: within(label, STORY_LIMITS.metricLabel, "figure's label") });
  }
  if (metrics.length > STORY_LIMITS.metrics) throw new SuccessStoryError(`Keep it to ${STORY_LIMITS.metrics} key figures`);

  const discover = oneLine(value.discoverSlug).replace(/^.*\/discover\//, "").replace(/[/?#].*$/, "");
  if (discover && !isDiscoverSlug(discover)) throw new SuccessStoryError("The Discover profile is its address after /discover/, e.g. dumitru-culiuc");

  return {
    slug,
    name,
    websiteUrl,
    logoUrl: logo || null,
    title,
    summary,
    categoryLabel,
    bodyHtml,
    metrics,
    discoverSlug: discover || null,
    seoTitle: within(oneLine(value.seoTitle), STORY_LIMITS.seoTitle, "SEO title") || null,
    seoDescription: within(oneLine(value.seoDescription), STORY_LIMITS.seoDescription, "SEO description") || null,
  };
}
