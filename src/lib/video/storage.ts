import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Where the videos' files live: the voice tracks, the finished reels and
 * carousel slides, and the customer's own pictures and clips. Supabase
 * Storage, like the article images (lib/images/storage.ts) - no new account.
 *
 * Public, because bundle.social and the render machine fetch the files by
 * URL. The names are random and nothing lists the bucket publicly. A reel's
 * files are deleted FILE_DAYS after it is posted (lib/video/cleanup.ts): by
 * then they are on the platforms.
 */

const BUCKET = "video-files";
/** A reel at 1080x1920 is 5-20 MB; the customer's clips at most this. */
export const MAX_CLIP_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const CLIP_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

function config(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function isVideoStorageConfigured(): boolean {
  return config() !== null;
}

function client() {
  const settings = config();
  if (!settings) throw new Error("Video storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(settings.url, settings.key, { auth: { persistSession: false } });
}

let bucketReady: Promise<void> | null = null;

/** The bucket, created the first time it is needed (public, files up to MAX_CLIP_BYTES). */
function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const storage = client().storage;
    const { data } = await storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_CLIP_BYTES });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create the video bucket: ${error.message}`);
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

const EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * A developer's machine without Supabase keeps the files in public/ (never
 * in production, where storage is configured): the page and the local
 * renderer reach them on the dev server.
 */
const DEV_FOLDER = `dev-${BUCKET}`;

async function storeLocally(path: string, data: Buffer | Uint8Array): Promise<string> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const file = join(process.cwd(), "public", DEV_FOLDER, ...path.split("/"));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/+$/, "");
  return `${base}/${DEV_FOLDER}/${path}`;
}

/** Stores a file under the website's folder and returns its public URL. */
export async function storeVideoFile(websiteId: string, folder: string, data: Buffer | Uint8Array, contentType: string): Promise<string> {
  const path = `${websiteId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${EXTENSIONS[contentType] ?? "bin"}`;
  if (!isVideoStorageConfigured() && process.env.NODE_ENV !== "production") return storeLocally(path, data);
  await ensureBucket();
  const bucket = client().storage.from(BUCKET);
  const { error } = await bucket.upload(path, data, { contentType, upsert: false });
  if (error) throw new Error(`Could not store the file: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * A signed upload address, so the customer's browser sends a clip straight
 * to storage - a 50 MB file never passes through a server function, whose
 * request body is limited to a few megabytes.
 */
export async function signedUpload(websiteId: string, contentType: string): Promise<{ signedUrl: string; publicUrl: string }> {
  await ensureBucket();
  const bucket = client().storage.from(BUCKET);
  const path = `${websiteId}/media/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${EXTENSIONS[contentType] ?? "bin"}`;
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not prepare the upload: ${error?.message ?? "no address"}`);
  return { signedUrl: data.signedUrl, publicUrl: bucket.getPublicUrl(path).data.publicUrl };
}

/** The bucket key of one of our URLs, only for the given website's folder; null for anything else. */
export function videoFilePath(url: string, websiteId: string): string | null {
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  return path.startsWith(`${websiteId}/`) && !path.includes("..") ? path : null;
}

/** Deletes files of ours, best effort: a file left behind costs a little storage, nothing more. */
export async function deleteVideoFiles(websiteId: string, urls: (string | null | undefined)[]): Promise<void> {
  if (!isVideoStorageConfigured()) return;
  const paths = urls.flatMap((url) => {
    const path = url ? videoFilePath(url, websiteId) : null;
    return path ? [path] : [];
  });
  if (paths.length === 0) return;
  await client()
    .storage.from(BUCKET)
    .remove(paths)
    .catch(() => undefined);
}
