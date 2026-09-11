"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { articles, websites } from "@/lib/db/schema";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import {
  ALLOWED_IMAGE_TYPES,
  deleteArticleImage,
  isImageStorageConfigured,
  listWebsiteImages,
  MAX_IMAGE_BYTES,
  storeArticleImage,
} from "@/lib/images/storage";
import { requireWebsite } from "@/lib/tenant";
import { track } from "@/lib/usage";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Changing an article's picture.
 *
 * The image was decided once, by the job that wrote the article, and could not
 * be seen or changed before it went live on the customer's website. These are
 * the three things someone actually wants: a different one, their own one, or
 * none.
 */

/**
 * Regenerations allowed per article.
 *
 * Each costs about four cents and earns nothing. A customer who does not like
 * the picture will try three or four prompts; one clicking twenty times is
 * exploring, not working, and the bill is ours either way.
 */
const MAX_REGENERATIONS = 5;

async function loadArticle(websiteId: string, articleId: string) {
  const { site, orgId } = await requireWebsite(websiteId);

  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      imageUrl: articles.imageUrl,
      imageAttempts: articles.imageAttempts,
    })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);

  return { site, orgId, article };
}

export async function regenerateArticleImage(
  websiteId: string,
  articleId: string,
  /** The customer's own description, or empty to use ours. */
  prompt: string,
): Promise<ActionResult<{ imageUrl: string }>> {
  const { site, orgId, article } = await loadArticle(websiteId, articleId);
  if (!article) return { ok: false, error: "Article not found" };

  if (!isImageGenerationConfigured()) {
    return { ok: false, error: "Image generation is not set up yet" };
  }
  if (!isImageStorageConfigured()) {
    return { ok: false, error: "Image storage is not set up yet" };
  }

  const attempts = article.imageAttempts ?? 0;
  if (attempts >= MAX_REGENERATIONS) {
    return {
      ok: false,
      error: `You have regenerated this image ${MAX_REGENERATIONS} times. Upload your own picture instead.`,
    };
  }

  const [website] = await db
    .select({ industry: websites.industry })
    .from(websites)
    .where(eq(websites.id, site.id))
    .limit(1);

  let stored: string;
  try {
    const generated = await generateArticleImage(
      article.title,
      website?.industry ?? null,
      prompt,
    );

    stored = await storeArticleImage(
      site.id,
      article.id,
      generated.data,
      generated.contentType,
    );

    await track(orgId, {
      kind: "image",
      websiteId: site.id,
      provider: "image",
      costUsd: generated.costUsd,
      metadata: { purpose: "article_header_regenerate", articleId },
    });
  } catch (error) {
    /**
     * The provider's own message, not a generic one. "Your prompt was
     * rejected" is actionable; "Something went wrong" sends the customer to
     * support for something they could have fixed themselves.
     */
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The image could not be generated",
    };
  }

  const previous = article.imageUrl;

  await db
    .update(articles)
    .set({
      imageUrl: stored,
      // Their prompt describes the picture better than the title does.
      imageAlt: prompt.trim() ? prompt.trim().slice(0, 300) : article.title,
      imageAttempts: attempts + 1,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, article.id));

  // After the row is updated: losing the old file matters less than losing
  // the new one, and this way a delete failure cannot strand the article
  // pointing at a picture that no longer exists.
  if (previous) await deleteArticleImage(previous);

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: { imageUrl: stored } };
}

export async function uploadArticleImage(
  websiteId: string,
  articleId: string,
  formData: FormData,
): Promise<ActionResult<{ imageUrl: string }>> {
  const { site, article } = await loadArticle(websiteId, articleId);
  if (!article) return { ok: false, error: "Article not found" };

  if (!isImageStorageConfigured()) {
    return { ok: false, error: "Image storage is not set up yet" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload" };
  }

  /**
   * Type and size are checked here rather than trusted from the browser. The
   * file ends up on the customer's live website, and a form post can claim
   * anything about what it is sending.
   */
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
    return { ok: false, error: "Use a PNG, JPEG or WebP image" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is ${Math.round(file.size / 1024 / 1024)}MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    };
  }

  const stored = await storeArticleImage(
    site.id,
    article.id,
    Buffer.from(await file.arrayBuffer()),
    file.type,
  );

  const previous = article.imageUrl;

  await db
    .update(articles)
    .set({ imageUrl: stored, updatedAt: new Date() })
    .where(eq(articles.id, article.id));

  if (previous) await deleteArticleImage(previous);

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: { imageUrl: stored } };
}

/**
 * Stores an image for use INSIDE the article body, and returns its URL.
 *
 * Separate from uploadArticleImage, which replaces the featured image. This
 * one changes no article row: the editor inserts the returned URL into the
 * body itself.
 *
 * It exists because a pasted or dragged image arrives as a data: URL, and the
 * sanitiser strips those — a data URL can carry an SVG with script inside, so
 * that rule stays. The effect was that pasting a picture looked fine in the
 * editor and then vanished on save, with nothing to explain it. Uploading the
 * bytes and inserting a real URL keeps both the paste and the rule.
 */
export async function uploadInlineImage(
  websiteId: string,
  articleId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const { site, article } = await loadArticle(websiteId, articleId);
  if (!article) return { ok: false, error: "Article not found" };

  if (!isImageStorageConfigured()) {
    return { ok: false, error: "Image storage is not set up yet" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload" };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
    return { ok: false, error: "Use a PNG, JPEG or WebP image" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is ${Math.round(file.size / 1024 / 1024)}MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
    };
  }

  const url = await storeArticleImage(
    site.id,
    article.id,
    Buffer.from(await file.arrayBuffer()),
    file.type,
  );

  /**
   * No revalidatePath: the body is client state being edited, and refreshing
   * the route would replace what the customer has typed since their last save.
   */
  return { ok: true, data: { url } };
}

/**
 * Pictures this website has used before, for the insert panel.
 *
 * Filtered by a search term against the file name. That is a weak search — the
 * names are timestamps — but it costs nothing and is honest about what it is;
 * a real library search needs a stock provider, which is a separate decision.
 */
export async function listReusableImages(
  websiteId: string,
  query?: string,
): Promise<ActionResult<{ images: { url: string; name: string }[] }>> {
  const { site } = await requireWebsite(websiteId);

  const all = await listWebsiteImages(site.id);
  const term = query?.trim().toLowerCase();

  return {
    ok: true,
    data: {
      images: term
        ? all.filter((image) => image.name.toLowerCase().includes(term))
        : all,
    },
  };
}

export async function removeArticleImage(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const { site, article } = await loadArticle(websiteId, articleId);
  if (!article) return { ok: false, error: "Article not found" };

  const previous = article.imageUrl;

  await db
    .update(articles)
    .set({ imageUrl: null, imageAlt: null, updatedAt: new Date() })
    .where(eq(articles.id, article.id));

  if (previous) await deleteArticleImage(previous);

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}

/** Updates the alt text alone, without touching the picture. */
export async function updateArticleImageAlt(
  websiteId: string,
  articleId: string,
  alt: string,
): Promise<ActionResult<null>> {
  const { site, article } = await loadArticle(websiteId, articleId);
  if (!article) return { ok: false, error: "Article not found" };

  await db
    .update(articles)
    .set({ imageAlt: alt.trim().slice(0, 300) || null, updatedAt: new Date() })
    .where(eq(articles.id, article.id));

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}
