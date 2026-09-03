import Link from "next/link";

import { PostCard } from "@/components/post-card";
import { BLOG_CATEGORIES, categoryCounts, listPosts } from "@/lib/blog/posts";

export const metadata = {
  title: "Blog",
  description:
    "Guides, comparisons and playbooks for getting found on Google and cited by AI assistants — written for people who run a business, not a marketing team.",
};

export default function BlogIndexPage() {
  const posts = listPosts();
  const counts = categoryCounts();

  return (
    <div>
      {/* Tinted hero, matching the tools pages. */}
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Blog
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            The SEO Platform <span className="text-primary">Blog</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
            Guides, comparisons and playbooks for the new era of search. How to
            get found on Google, and how to get your business named by ChatGPT,
            Claude, Gemini and Perplexity.
          </p>

          {/*
            Counts are real, read from the posts themselves. A category chip
            claiming a number the index cannot fill is the first thing a
            reader notices.
          */}
          <ul className="mt-7 flex flex-wrap gap-2.5">
            {/*
              Empty categories are hidden rather than shown with a zero. A chip
              reading "Comparisons 0" advertises a section with nothing in it and
              makes the whole blog look abandoned; the category page still exists
              for when the first post lands.
            */}
            {BLOG_CATEGORIES.filter(
              (category) => counts[category.name] > 0,
            ).map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/blog/category/${category.slug}`}
                  className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
                >
                  {category.name}
                  <span className="text-muted-foreground tabular-nums">
                    {counts[category.name]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            Latest articles
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {posts.length} {posts.length === 1 ? "article" : "articles"}
          </p>
        </div>

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
