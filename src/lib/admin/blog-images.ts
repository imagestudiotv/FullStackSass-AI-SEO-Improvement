"use server";

import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import {
  BLOG_IMAGE_FOLDER,
  deleteStoredImage,
  isImageStorageConfigured,
  listStoredImages,
  storedImagePath,
} from "@/lib/images/storage";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * The pictures uploaded for RepGet's own blog (client, 2026-10-09: "We need to
 * have all images uploaded in the admin, in this way we can having control and
 * delete the images we are no longer using").
 *
 * The list is the storage folder itself (BLOG_IMAGE_FOLDER), so a picture
 * uploaded and never saved into a post is listed too. Which posts use a
 * picture is read from the posts' text at the time of asking; a picture in
 * use cannot be deleted.
 */

export type BlogImage = {
  url: string;
  name: string;
  size: number | null;
  createdAt: string | null;
  /** The description (alt text) it has in the first post that uses it. */
  alt: string | null;
  usedIn: { id: string; title: string; slug: string; status: string }[];
};

type PostText = { id: string; title: string; slug: string; status: string; bodyHtml: string };

async function postTexts(): Promise<PostText[]> {
  return db
    .select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, status: blogPosts.status, bodyHtml: blogPosts.bodyHtml })
    .from(blogPosts);
}

/** The posts whose text contains this picture's address (or its storage key, if a link was rewritten). */
function usage(url: string, path: string, posts: PostText[]) {
  return posts.filter((post) => post.bodyHtml.includes(url) || post.bodyHtml.includes(`/${path}`));
}

const decode = (value: string) =>
  value.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The alt text of the first <img> showing this picture, if any. */
function altFor(url: string, posts: PostText[]): string | null {
  for (const post of posts) {
    const at = post.bodyHtml.indexOf(url);
    if (at < 0) continue;
    const start = post.bodyHtml.lastIndexOf("<img", at);
    const end = post.bodyHtml.indexOf(">", at);
    if (start < 0 || end < 0) continue;
    const alt = /\balt="([^"]*)"/.exec(post.bodyHtml.slice(start, end + 1))?.[1];
    if (alt && alt.trim()) return decode(alt.trim());
  }
  return null;
}

/** Every blog picture, newest first, with where it is used. `term` matches the description, file name or a post title. */
export async function listBlogImages(term = ""): Promise<{ configured: boolean; images: BlogImage[] }> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { configured: false, images: [] };
  const [files, posts] = await Promise.all([listStoredImages(BLOG_IMAGE_FOLDER), postTexts()]);
  const images = files.map((file) => ({
    url: file.url,
    name: file.name,
    size: file.size,
    createdAt: file.createdAt,
    alt: altFor(file.url, posts),
    usedIn: usage(file.url, file.path, posts).map(({ id, title, slug, status }) => ({ id, title, slug, status })),
  }));
  const needle = term.trim().toLowerCase();
  if (!needle) return { configured: true, images };
  return {
    configured: true,
    images: images.filter((image) =>
      [image.alt ?? "", image.name, ...image.usedIn.map((post) => post.title)].some((text) => text.toLowerCase().includes(needle)),
    ),
  };
}

/**
 * The same pictures for the post editor's picker, so an image already
 * uploaded can be used again instead of uploaded twice.
 */
export async function listBlogImagesForPicker(term: string): Promise<{ url: string; name: string }[]> {
  const { images } = await listBlogImages(term);
  return images.slice(0, 60).map((image) => ({ url: image.url, name: image.alt ?? image.name }));
}

/** Deletes a blog picture that no post uses. */
export async function deleteBlogImage(url: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: "Image storage is not set up yet" };
  const path = typeof url === "string" ? storedImagePath(url) : null;
  // Only a file directly in the blog folder: never a customer's picture, never a folder.
  if (!path || !path.startsWith(`${BLOG_IMAGE_FOLDER}/`) || path.slice(BLOG_IMAGE_FOLDER.length + 1).includes("/")) {
    return { ok: false, error: "That is not a blog picture." };
  }
  const users = usage(url, path, await postTexts());
  if (users.length > 0) {
    return {
      ok: false,
      error: `This picture is used in ${users.map((post) => `"${post.title}"`).join(", ")}. Remove it from ${users.length === 1 ? "that post" : "those posts"} first.`,
    };
  }
  try {
    await deleteStoredImage(path);
  } catch (error) {
    console.error("[admin/blog-images] delete failed", error);
    return { ok: false, error: "The picture could not be deleted. Try again." };
  }
  await recordAdminAction({
    actorEmail: admin.email,
    action: "blog.image_deleted",
    targetType: "blog_image",
    targetId: path,
    summary: `Deleted the blog picture ${path.slice(BLOG_IMAGE_FOLDER.length + 1)}`,
    detail: { path },
  });
  revalidatePath("/admin/blog/images");
  return { ok: true, data: null };
}
