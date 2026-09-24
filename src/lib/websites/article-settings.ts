"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { updateBrandVoice } from "@/lib/brand/actions";
import { requireEditor } from "@/lib/websites/require-editor";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Every article setting, saved in one call.
 *
 * WHY ONE ACTION AND NOT TWENTY SETTERS: the client asked for a single save.
 * "I think we can have a Save button fixed here, so once we scroll we can
 * save the setting each time we want, instead of having save buttons on each
 * section we scroll." Twenty per-field actions would mean twenty round trips
 * for one press, twenty chances to half-save, and a screen that can end up in
 * a state the customer never chose — some fields written, some not, with
 * nothing saying which.
 *
 * The existing setAutoPublish and setGenerationMode stay. They are used by
 * toggles elsewhere that write immediately and have no Save button of their
 * own; this is the form path, not a replacement.
 */

/** What the form sends. Every field optional: a partial save is legitimate. */
export type ArticleSettingsInput = {
  publishAs?: "live" | "draft";
  articleStyle?: string;
  internalLinkTarget?: number;
  /** Null means adaptive — chosen per article rather than fixed. */
  targetWordCount?: number | null;

  sitemapUrl?: string | null;
  blogUrl?: string | null;
  exampleArticleUrl?: string | null;

  brandColor?: string | null;
  imageStyle?: string;
  featuredImageStyle?: string;
  imageBrief?: string | null;
  imageInstructions?: string | null;

  tableOfContents?: boolean;
  youtubeVideo?: boolean;
  authorPerspective?: boolean;
  mentionSimilarProducts?: boolean;
  poweredByLink?: boolean;

  authorName?: string | null;
  authorBio?: string | null;

  /* --- Brand voice, merged in from the old "How we write" panel ------ */

  /**
   * These live in brand_voice, not websites, and are written by
   * updateBrandVoice rather than the update below.
   *
   * WHY DELEGATE INSTEAD OF INLINING: that action already validates social
   * and example URLs properly — they are fetched server-side when an article
   * is written and embedded in published pages, so an unchecked value is a
   * request our server makes to wherever somebody typed, and a link on the
   * customer's live site. Re-implementing that here would be a second copy
   * of a security check, and the copy is the one that rots.
   */
  tone?: string | null;
  vocabulary?: string | null;
  avoid?: string | null;
  /** One per line in the UI; the action splits them. */
  usps?: string;
  facts?: string;
  articleInstructions?: string | null;
};

/** Trims, and turns an empty field into null rather than an empty string. */
function text(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A URL, or null. Anything unparseable is rejected rather than stored.
 *
 * These are read by the writer to find pages worth linking to, so a typo
 * here is a broken link in a published article rather than a cosmetic
 * problem in a form.
 */
function url(
  value: string | null | undefined,
  label: string,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  const cleaned = text(value);
  if (cleaned === undefined || cleaned === null) return { ok: true, value: cleaned };
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `${label} must start with http:// or https://` };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: `${label} is not a valid address` };
  }
}

/** Hex colour, or null. */
function hex(value: string | null | undefined): string | null | undefined {
  const cleaned = text(value);
  if (cleaned === undefined || cleaned === null) return cleaned;
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned.toLowerCase() : undefined;
}

export async function saveArticleSettings(
  websiteId: string,
  input: ArticleSettingsInput,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const sitemap = url(input.sitemapUrl, "Sitemap URL");
  if (!sitemap.ok) return { ok: false, error: sitemap.error };
  const blog = url(input.blogUrl, "Main blog address");
  if (!blog.ok) return { ok: false, error: blog.error };
  const example = url(input.exampleArticleUrl, "Example article URL");
  if (!example.ok) return { ok: false, error: example.error };

  /**
   * Bounded rather than trusted. These come from a form a customer can edit,
   * and both feed the writer directly: a word count of 100,000 is a bill, and
   * forty internal links in one article is a penalty.
   */
  const links =
    input.internalLinkTarget === undefined
      ? undefined
      : Math.min(Math.max(Math.round(input.internalLinkTarget), 0), 20);

  const words =
    input.targetWordCount === undefined || input.targetWordCount === null
      ? input.targetWordCount
      : Math.min(Math.max(Math.round(input.targetWordCount), 300), 5000);

  /**
   * Brand voice first, because it is the half that can REFUSE.
   *
   * updateBrandVoice rejects a malformed URL, and a save that wrote the
   * website row and then failed here would leave the screen reporting an
   * error while half the form had already been stored — the customer presses
   * Save again and cannot tell what did or did not land.
   *
   * Only called when at least one voice field was sent, so a save from a
   * form that does not carry them cannot blank the row.
   */
  const touchesVoice =
    input.tone !== undefined ||
    input.vocabulary !== undefined ||
    input.avoid !== undefined ||
    input.usps !== undefined ||
    input.facts !== undefined ||
    input.articleInstructions !== undefined;

  if (touchesVoice) {
    const voice = await updateBrandVoice(websiteId, {
      tone: input.tone,
      vocabulary: input.vocabulary,
      avoid: input.avoid,
      usps: input.usps,
      facts: input.facts,
      articleInstructions: input.articleInstructions,
    });
    if (!voice.ok) return voice;
  }

  await db
    .update(websites)
    .set({
      /*
        Records that the settings were reviewed, whatever was in the form.
        The checklist reads this instead of demanding a brand_voice row -
        keeping every default is a choice, and it used to leave the step
        open forever. See onboarding/launch.ts, the "preferences" step.
      */
      articleSettingsReviewedAt: new Date(),
      publishAs: input.publishAs,
      articleStyle: input.articleStyle,
      internalLinkTarget: links,
      targetWordCount: words,
      sitemapUrl: sitemap.value,
      blogUrl: blog.value,
      exampleArticleUrl: example.value,
      brandColor: hex(input.brandColor),
      imageStyle: input.imageStyle,
      featuredImageStyle: input.featuredImageStyle,
      imageBrief: text(input.imageBrief),
      imageInstructions: text(input.imageInstructions),
      tableOfContents: input.tableOfContents,
      youtubeVideo: input.youtubeVideo,
      authorPerspective: input.authorPerspective,
      mentionSimilarProducts: input.mentionSimilarProducts,
      poweredByLink: input.poweredByLink,
      authorName: text(input.authorName),
      authorBio: text(input.authorBio),
      updatedAt: new Date(),
    })
    .where(eq(websites.id, site.id));

  revalidatePath(`/websites/${site.id}/publishing`);
  return { ok: true, data: null };
}
