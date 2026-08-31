import Link from "next/link";

import { listPosts } from "@/lib/blog/posts";

export const metadata = {
  title: "Blog",
  description:
    "Plain-English guides to getting found on Google and in AI assistants, for people who run a business rather than a marketing team.",
};

/** Long-form dates, since a blog index read by humans is not a log file. */
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  const posts = listPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Blog
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Plain-English guides to getting found on Google and in AI assistants,
          written for people who run a business rather than a marketing team.
        </p>
      </header>

      <ul className="mt-12 space-y-10">
        {posts.map((post) => (
          <li key={post.slug}>
            <article>
              {/*
                The whole card is not a link: a nested link to a post's own
                content would be unreachable by keyboard. The title is the
                link, which is also what a screen reader announces.
              */}
              <h2 className="text-xl font-medium tracking-tight">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-muted-foreground">{post.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                <time dateTime={post.publishedAt}>
                  {formatDate(post.publishedAt)}
                </time>
                <span className="mx-2">·</span>
                {post.readingMinutes} min read
              </p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
