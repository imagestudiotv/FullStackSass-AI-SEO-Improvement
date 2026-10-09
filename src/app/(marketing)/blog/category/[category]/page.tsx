import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { categoryBySlug } from "@/lib/blog/categories";
import { blogPage, blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage } from "@/lib/blog/posts";
import { jsonLdScript } from "@/lib/blog/shared";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList } from "@/lib/structured-data";

import { ClosingCta } from "../../../home-sections";

// Live posts from the database (see lib/blog/posts.ts).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/blog/category/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await categoryBySlug(slug);

  if (!category) return { title: "Category not found" };

  // Page 2 on has a title and description of its own, beside its own canonical.
  const page = blogPage((await searchParams).page);
  return {
    title: `${category.name}${pageSuffix(page)}`,
    description: page > 1 ? `${category.blurb.replace(/\.$/, "")}${pageSuffix(page)}.` : category.blurb,
    ...publicPageMetadata(blogPageHref(`/blog/category/${category.slug}`, page)),
  };
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: PageProps<"/blog/category/[category]">) {
  const { category: slug } = await params;
  const category = await categoryBySlug(slug);

  // An unknown category is a genuine 404, not an empty grid: a soft 404 keeps
  // a dead URL in the index indefinitely.
  if (!category) notFound();

  const page = blogPage((await searchParams).page);
  const { posts, total } = await listPostPage(page, { category: category.name });
  // Past the last page is a 404, not the empty-section message.
  if (page > 1 && posts.length === 0) notFound();

  // The visible trail below, as structured data: same names, same order.
  const trail = breadcrumbList(siteUrl(), [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: category.name, path: `/blog/category/${category.slug}` },
  ]);

  return (
    <div>
      <script
        type="application/ld+json"
        // Category names are typed in the admin panel: escaped, not trusted.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(trail) }}
      />
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
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        <BlogPagination page={page} total={total} path={`/blog/category/${category.slug}`} />
      </div>

      <ClosingCta t={getMessages("en").home} href={(path) => path} />
    </div>
  );
}
