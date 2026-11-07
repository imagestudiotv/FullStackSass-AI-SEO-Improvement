import Image from "next/image";

import { PostCover } from "@/components/post-cover";
import type { BlogPost } from "@/lib/blog/shared";
import { cn } from "@/lib/utils";

/**
 * A post's cover wherever the blog shows one: its featured image when it has
 * one (Admin -> Blog), the drawn cover otherwise (components/post-cover.tsx).
 *
 * The same box either way - the caller's shape (aspect-[100/56]) - with the
 * picture cropped to fill it, so a card grid stays even and nothing moves
 * while the picture loads. next/image serves it in the sizes the page
 * needs (`sizes`), not the 8 MB original; the storage address is allowed in
 * next.config.ts (images.remotePatterns).
 */
export function BlogCover({
  post,
  className,
  sizes,
  preload = false,
}: {
  post: Pick<BlogPost, "slug" | "title" | "category" | "featuredImage">;
  className?: string;
  /** How wide the cover is at each screen width, for the browser to choose a size. */
  sizes: string;
  /** The top of a post: its largest picture, fetched first. */
  preload?: boolean;
}) {
  if (!post.featuredImage) {
    // The English category: it picks the cover's colour, the same in every language.
    return <PostCover slug={post.slug} title={post.title} category={post.category} className={className} />;
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={post.featuredImage.url}
        alt={post.featuredImage.alt}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
