import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { listCategories } from "@/lib/blog/categories";
import { blogPage, blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage, publishedCategoryCounts } from "@/lib/blog/posts";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { ClosingCta } from "../home-sections";

const DESCRIPTION =
  "Guides, comparisons and playbooks for getting found on Google and cited by AI assistants - written for people who run a business, not a marketing team.";

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // Page 2 on has a title and description of its own, beside its own canonical.
  const page = blogPage((await searchParams).page);
  return {
    title: `Blog${pageSuffix(page)}`,
    description: page > 1 ? `${DESCRIPTION.replace(/\.$/, "")}${pageSuffix(page)}.` : DESCRIPTION,
    ...publicPageMetadata(blogPageHref("/blog", page)),
  };
}

// Live posts from the database (see lib/blog/posts.ts).
export const dynamic = "force-dynamic";

export default async function BlogIndexPage({ searchParams }: Props) {
  const page = blogPage((await searchParams).page);
  const [{ posts, total }, categories, counts] = await Promise.all([
    listPostPage(page),
    listCategories(),
    publishedCategoryCounts(),
  ]);
  // Past the last page is a 404, not an empty grid.
  if (page > 1 && posts.length === 0) notFound();

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
            The RepGet <span className="text-primary">Blog</span>
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
            {categories.filter(
              (category) => (counts[category.name] ?? 0) > 0,
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
            {total} {total === 1 ? "article" : "articles"}
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>

        {/* 30 to a page (client, 2026-10-08), then the next page. */}
        <BlogPagination page={page} total={total} path="/blog" />
      </div>

      {/* The blog exists to bring people into the product: the homepage's closing panel. */}
      <ClosingCta t={getMessages("en").home} href={(path) => path} />
    </div>
  );
}
