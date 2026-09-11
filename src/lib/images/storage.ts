import { createClient } from "@supabase/supabase-js";

/**
 * Where an article's image lives before it is published.
 *
 * Generated images used to exist only inside the job that made them: held in
 * memory, uploaded to the customer's CMS at publish, and gone otherwise. That
 * is enough for "write an article and publish it" and nothing else. It cannot
 * support looking at the picture before publishing, replacing one you dislike,
 * or uploading your own — all of which need the file to outlive the request.
 *
 * Supabase Storage rather than a new provider: the database is already there,
 * so this is a bucket and a key rather than another account, another bill and
 * another set of credentials to lose.
 *
 * The service role key is used because uploads happen in server actions and
 * background jobs on behalf of a customer who has no Supabase identity. It
 * MUST never reach the browser — it bypasses row-level security entirely.
 */

const BUCKET = "article-images";

/** 8MB. Comfortably above a generated PNG, below anything worth worrying about. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** What a customer may upload. Formats a CMS will accept and a browser renders. */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

function config(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

/**
 * True when images can be stored.
 *
 * Everything that stores an image checks this first and degrades rather than
 * throwing: without storage the product still writes and publishes articles
 * exactly as it did before, it just cannot hold a picture in between.
 */
export function isImageStorageConfigured(): boolean {
  return config() !== null;
}

function client() {
  const settings = config();
  if (!settings) {
    throw new Error(
      "Image storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(settings.url, settings.key, {
    auth: { persistSession: false },
  });
}

/** File extension for a stored MIME type. */
function extensionFor(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

/**
 * Stores an image and returns a public URL for it.
 *
 * Keyed by website and article so a bucket listing is readable and one
 * customer's files are not interleaved with another's. The random suffix
 * defeats browser and CDN caching: replacing an image at a fixed path would
 * leave the old picture on screen until the cache expired, which reads as the
 * replace button not working.
 */
export async function storeArticleImage(
  websiteId: string,
  articleId: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = client();
  const path = `${websiteId}/${articleId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(contentType)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, { contentType, upsert: false });

  if (error) {
    throw new Error(`Could not store the image: ${error.message}`);
  }

  const { data: published } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return published.publicUrl;
}

/**
 * Images already used somewhere on this website.
 *
 * Offered when inserting a picture into an article, because the useful set is
 * almost always one the customer already has: a photographer reuses the same
 * venue shots, a dentist the same surgery. Buying or generating a new picture
 * for every article is the expensive way to answer a question they have
 * usually already answered.
 *
 * Listed per article folder rather than recursively, because Supabase returns
 * directories rather than descending, and a flat listing of the website prefix
 * gives back folder names with no files in them.
 */
export async function listWebsiteImages(
  websiteId: string,
  limit = 24,
): Promise<{ url: string; name: string }[]> {
  if (!isImageStorageConfigured()) return [];

  const supabase = client();

  const { data: folders, error } = await supabase.storage
    .from(BUCKET)
    .list(websiteId, { limit: 40, sortBy: { column: "created_at", order: "desc" } });

  if (error || !folders) return [];

  const found: { url: string; name: string; at: string }[] = [];

  for (const folder of folders) {
    if (found.length >= limit) break;
    // A file at this level has metadata; a folder does not.
    if (folder.metadata) continue;

    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${websiteId}/${folder.name}`, {
        limit: 10,
        sortBy: { column: "created_at", order: "desc" },
      });

    for (const file of files ?? []) {
      if (!file.metadata) continue;
      const path = `${websiteId}/${folder.name}/${file.name}`;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      found.push({
        url: data.publicUrl,
        name: file.name,
        at: (file.created_at as string) ?? "",
      });
    }
  }

  // Newest first across every article, not just within each one.
  return found
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(({ url, name }) => ({ url, name }));
}

/**
 * Deletes a stored image, given the public URL we handed out.
 *
 * Best effort: a failure here leaves an orphaned file, which costs a little
 * storage. Refusing to replace an image because the old one could not be
 * deleted would be a worse trade.
 *
 * Only touches URLs inside our own bucket. An image already published to the
 * customer's CMS is on their server and is not ours to remove.
 */
export async function deleteArticleImage(url: string): Promise<void> {
  if (!isImageStorageConfigured()) return;

  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = url.slice(index + marker.length);
  if (!path) return;

  await client()
    .storage.from(BUCKET)
    .remove([decodeURIComponent(path)])
    .catch(() => undefined);
}
