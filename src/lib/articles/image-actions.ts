"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { articles, websites } from "@/lib/db/schema";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import { describeArticleScene } from "@/lib/images/scene";
import {
  ALLOWED_IMAGE_TYPES,
  deleteArticleImage,
  isImageStorageConfigured,
  listWebsiteImages,
  MAX_IMAGE_BYTES,
  storeArticleImage,
} from "@/lib/images/storage";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import { track } from "@/lib/usage";
import type { ActionResult } from "@/lib/websites/actions";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import {
  paidCall,
  releaseUnspent,
  reserveAll,
} from "@/lib/billing/spend-quota";
import { syncApproval } from "@/lib/articles/review";
import { ArticleInFlightError, editArticle, isInFlight } from "@/lib/publishing/dispatch";

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

/**
 * Image generations per workspace per sliding hour, across all its articles.
 */
const IMAGES_PER_WORKSPACE_PER_HOUR = 20;

/**
 * Loads an article for a WRITE, refusing view-only callers.
 *
 * requireEditor, not requireWebsite. Every caller of this helper changes
 * something — regenerating an image spends real money on the owner's plan,
 * and removing one deletes the stored file — so a viewer reaching them could
 * run up the workspace's image bill or destroy the pictures on a live site.
 * requireWebsite returns successfully for `access: "viewer"`, so guarding
 * here is what makes the Viewer role mean anything on this screen.
 *
 * listReusableImages is deliberately not routed through this: it only reads,
 * and a viewer is meant to see everything.
 *
 * Returns `null` context on refusal so each action can surface the message
 * rather than throw, matching how the other write actions report it.
 */
async function loadArticle(websiteId: string, articleId: string) {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) {
    return { site: null, article: undefined, error: guard.error };
  }
  /*
    No organization id is returned. Callers read site.organizationId - the
    workspace that PAYS for the site - and returning the caller's own `orgId`
    beside it only invited the two to be confused. See lib/tenant.ts.
  */
  const { site } = guard.context;

  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      targetKeyword: articles.targetKeyword,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAttempts: articles.imageAttempts,
    })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);

  return { site, article, error: null as string | null };
}

export async function regenerateArticleImage(
  websiteId: string,
  articleId: string,
  /** The customer's own description, or empty to use ours. */
  prompt: string,
): Promise<ActionResult<{ imageUrl: string }>> {
  const { site, article, error } = await loadArticle(websiteId, articleId);
  if (error) return { ok: false, error };
  if (!site || !article) return { ok: false, error: "Article not found" };
  // Not while it is being sent: the paid picture could not be saved.
  if (await isInFlight(article.id)) return { ok: false, error: new ArticleInFlightError().message };
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  /*
    Entitlement before spend. Each regeneration is a billed image call, and
    this action is a public endpoint whatever the page in front of it does.
  */
  // A free article's picture is part of the article (lib/billing/free-articles.ts).
  const entitled = await isEntitledToSpend(site.id, { freeArticles: true });
  if (!entitled.ok) return { ok: false, error: entitled.error };

  if (!isImageGenerationConfigured()) {
    return { ok: false, error: "Image generation is not set up yet" };
  }
  if (!isImageStorageConfigured()) {
    return { ok: false, error: "Image storage is not set up yet" };
  }

  /*
    Two caps, reserved together and atomically before anything is paid for:
    MAX_REGENERATIONS for this article over its lifetime, and an hourly
    ceiling for the workspace, since someone cycling through thirty articles
    stays under every per-article cap. The per-article cap used to read
    imageAttempts, call the provider and write attempts + 1 afterwards, so
    simultaneous presses all read the same count and all paid.
  */
  const slot = await reserveAll(
    [
      {
        key: `image-regenerate:article:${article.id}`,
        limit: MAX_REGENERATIONS,
        window: { since: new Date(0) },
        // Regenerations made before the ledger existed still count.
        floor: async (tx) => {
          const [row] = await tx
            .select({ attempts: articles.imageAttempts })
            .from(articles)
            .where(eq(articles.id, article.id));
          return row?.attempts ?? 0;
        },
      },
      {
        key: `image:org:${ownerOrgId}`,
        limit: IMAGES_PER_WORKSPACE_PER_HOUR,
        window: { seconds: 60 * 60 },
      },
    ],
    {
      operation: "image.regenerate",
      organizationId: ownerOrgId,
      websiteId: site.id,
      metadata: { articleId: article.id },
    },
  );
  if (!slot.ok) {
    return {
      ok: false,
      error: slot.rule.key.startsWith("image-regenerate:article:")
        ? `You have regenerated this image ${MAX_REGENERATIONS} times. Upload your own picture instead.`
        : "You have generated many images in the last hour. Please try again shortly.",
    };
  }

  const [website] = await db
    .select({
      industry: websites.industry,
      country: websites.country,
      imageStyle: websites.imageStyle,
      imageBrief: websites.imageBrief,
      imageInstructions: websites.imageInstructions,
    })
    .from(websites)
    .where(eq(websites.id, site.id))
    .limit(1);

  let stored: string;
  let alt: string = article.title;
  try {
    /*
      Without their own description, the picture is matched to the article's
      content - the same way a new article's image is made - rather than to
      the title alone. The website's image style applies either way.
    */
    const scene = prompt.trim()
      ? null
      : await paidCall(slot.reservations, () => describeArticleScene({
          title: article.title,
          targetKeyword: article.targetKeyword,
          industry: website?.industry ?? null,
          country: website?.country ?? null,
          bodyHtml: article.bodyHtml,
        }));
    const generated = await paidCall(slot.reservations, () => generateArticleImage(
      article.title,
      website?.industry ?? null,
      prompt,
      {
        style: website?.imageStyle,
        brief: website?.imageBrief,
        instructions: website?.imageInstructions,
        scene: scene?.scene,
        alt: scene?.alt,
      },
    ));
    alt = generated.alt;

    stored = await storeArticleImage(
      site.id,
      article.id,
      generated.data,
      generated.contentType,
    );

    await track(ownerOrgId, {
      kind: "image",
      websiteId: site.id,
      provider: "image",
      costUsd: generated.costUsd,
      metadata: { purpose: "article_header_regenerate", articleId },
    });
  } catch (error) {
    // A refusal before any charge hands the slots back; a spent call keeps them.
    await releaseUnspent(slot.reservations, "provider_refused");
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

  const refused = await writeImage(article.id, {
    imageUrl: stored,
    // Their prompt, or the matched scene, describes the picture better
    // than the title does.
    imageAlt: prompt.trim() ? prompt.trim().slice(0, 300) : alt,
    // Display only; the reservation above is what enforces the cap.
    imageAttempts: sql`${articles.imageAttempts} + 1`,
    updatedAt: new Date(),
  });
  if (refused) {
    await deleteArticleImage(stored);
    return { ok: false, error: refused };
  }

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
  const { site, article, error } = await loadArticle(websiteId, articleId);
  if (error) return { ok: false, error };
  if (!site || !article) return { ok: false, error: "Article not found" };

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

  const refused = await writeImage(article.id, { imageUrl: stored, updatedAt: new Date() });
  if (refused) {
    await deleteArticleImage(stored);
    return { ok: false, error: refused };
  }

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
  const { site, article, error } = await loadArticle(websiteId, articleId);
  if (error) return { ok: false, error };
  if (!site || !article) return { ok: false, error: "Article not found" };

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

/**
 * Writes an image change under the article's row lock, and returns it to
 * the review queue when it changes an approved article. Refused while the
 * article is being sent to the website (lib/publishing/dispatch.ts).
 */
async function writeImage(articleId: string, patch: Parameters<ReturnType<typeof db.update<typeof articles>>["set"]>[0]): Promise<string | null> {
  try {
    await editArticle(articleId, async (tx) => {
      await tx.update(articles).set(patch).where(eq(articles.id, articleId));
      // An image change after approval goes back to the review queue.
      await syncApproval(articleId, tx);
    });
    return null;
  } catch (error) {
    if (error instanceof ArticleInFlightError) return error.message;
    throw error;
  }
}

export async function removeArticleImage(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const { site, article, error } = await loadArticle(websiteId, articleId);
  if (error) return { ok: false, error };
  if (!site || !article) return { ok: false, error: "Article not found" };

  const previous = article.imageUrl;

  const refused = await writeImage(article.id, { imageUrl: null, imageAlt: null, updatedAt: new Date() });
  if (refused) return { ok: false, error: refused };

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
  const { site, article, error } = await loadArticle(websiteId, articleId);
  if (error) return { ok: false, error };
  if (!site || !article) return { ok: false, error: "Article not found" };

  const refused = await writeImage(article.id, { imageAlt: alt.trim().slice(0, 300) || null, updatedAt: new Date() });
  if (refused) return { ok: false, error: refused };
  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}
