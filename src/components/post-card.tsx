import Link from "next/link";

import { PostCover } from "@/components/post-cover";
import type { BlogPost } from "@/lib/blog/posts";

/** Long-form dates, since a blog index read by humans is not a log file. */
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A post as a card: cover, category, title, summary, date and read time.
 *
 * The whole card is not one link. A card-sized anchor wrapping a category chip
 * that is itself a link produces nested interactive elements, which is invalid
 * and unreachable by keyboard. Instead the title is the link and an overlay
 * stretches its hit area over the card, leaving the chip separately clickable.
 */
export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
      <PostCover
        slug={post.slug}
        title={post.title}
        category={post.category}
        className="aspect-[100/56] w-full border-b"
      />

      <div className="flex flex-1 flex-col p-5">
        <Link
          href={`/blog/category/${post.category.toLowerCase()}`}
          className="relative z-10 w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted-foreground/15"
        >
          {post.category}
        </Link>

        <h3 className="mt-3 font-semibold tracking-tight text-balance">
          <Link
            href={`/blog/${post.slug}`}
            // Stretches the link over the whole card without nesting anchors.
            className="after:absolute after:inset-0 group-hover:text-primary"
          >
            {post.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {post.description}
        </p>

        {/* mt-auto pins the meta line to the bottom so it aligns across a row. */}
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>
            {formatPostDate(post.publishedAt)}
          </time>
          <span className="mx-1.5">·</span>
          {post.readingMinutes} min read
        </p>
      </div>
    </article>
  );
}
