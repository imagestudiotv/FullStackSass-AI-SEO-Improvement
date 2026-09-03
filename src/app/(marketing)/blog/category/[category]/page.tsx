import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/post-card";
import {
  BLOG_CATEGORIES,
  categoryBySlug,
  postsByCategory,
} from "@/lib/blog/posts";

/** Every category is known at build time, so all of them are prerendered. */
export function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/category/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);

  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description: category.blurb,
    alternates: { canonical: `/blog/category/${category.slug}` },
  };
}

export default async function BlogCategoryPage({
  params,
}: PageProps<"/blog/category/[category]">) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);

  // An unknown category is a genuine 404, not an empty grid: a soft 404 keeps
  // a dead URL in the index indefinitely.
  if (!category) notFound();

  const posts = postsByCategory(category.name);

  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-14">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/" className="text-primary hover:underline">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog" className="text-primary hover:underline">
              Blog
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            {category.name}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            {category.blurb}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        {posts.length === 0 ? (
          /*
            Stated plainly rather than shown as an empty grid. This category
            exists because posts are coming, and saying so is better than a
            page that looks broken.
          */
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              We have not published in this section yet.{" "}
              <Link href="/blog" className="underline underline-offset-4">
                Read everything else
              </Link>{" "}
              in the meantime.
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
