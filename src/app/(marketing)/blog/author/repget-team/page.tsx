import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogPagination } from "@/components/blog-pagination";
import { PostCard } from "@/components/post-card";
import { blogPage, blogPageHref, pageSuffix } from "@/lib/blog/pagination";
import { listPostPage } from "@/lib/blog/posts";
import { jsonLdScript, TEAM_AUTHOR, TEAM_AUTHOR_PATH } from "@/lib/blog/shared";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, entityIds } from "@/lib/structured-data";

import { ClosingCta } from "../../../home-sections";

/**
 * The RepGet team's author page (client, 2026-10-08, after
 * outrank.so/blog/author/outrank): who writes the blog, and every post they
 * wrote, 30 to a page. Each of those posts' bylines links here, and their
 * structured data names this page as the author's.
 *
 * Rendered per request from the database, like the rest of the blog.
 */
export const dynamic = "force-dynamic";

const BIO =
  "The team behind RepGet. We write practical guides to keyword research, SEO content, publishing, backlinks, and getting your business found on Google and named by AI assistants.";

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = blogPage((await searchParams).page);
  return {
    title: `${TEAM_AUTHOR}${pageSuffix(page)}`,
    description: `Guides and playbooks from the RepGet team${pageSuffix(page)}.`,
    ...publicPageMetadata(blogPageHref(TEAM_AUTHOR_PATH, page)),
  };
}

export default async function TeamAuthorPage({ searchParams }: Props) {
  const page = blogPage((await searchParams).page);
  const { posts, total } = await listPostPage(page, { author: TEAM_AUTHOR });
  // Past the last page is a 404, not an empty grid.
  if (page > 1 && posts.length === 0) notFound();

  const site = siteUrl();
  const address = `${site}${TEAM_AUTHOR_PATH}`;
  const jsonLd = [
    /*
      A profile page about the team: what Google reads for an author page.
      The team is part of the Organization the homepage defines.
    */
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: address,
      name: TEAM_AUTHOR,
      mainEntity: {
        "@type": "Organization",
        name: TEAM_AUTHOR,
        url: address,
        description: BIO,
        logo: `${site}/icon-512.png`,
        parentOrganization: { "@id": entityIds(site).organization },
      },
    },
    // The visible trail below, as structured data: same names, same order.
    breadcrumbList(site, [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: TEAM_AUTHOR, path: TEAM_AUTHOR_PATH },
    ]),
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        // Built from constants here, but escaped like every blog page's.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog" className="text-primary hover:underline">
              Blog
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{TEAM_AUTHOR}</span>
          </nav>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <Image
              src="/images/repget-mark.png"
              alt=""
              width={88}
              height={88}
              className="size-18 shrink-0 rounded-full border bg-card p-3 sm:size-22"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Author</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">{TEAM_AUTHOR}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{BIO}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Articles</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? "article" : "articles"}
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="mt-8 rounded-xl border bg-card p-8 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              The team&apos;s first article is on its way.{" "}
              <Link href="/blog" className="underline underline-offset-4">
                Read the blog
              </Link>{" "}
              in the meantime.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        <BlogPagination page={page} total={total} path={TEAM_AUTHOR_PATH} />
      </div>

      <ClosingCta t={getMessages("en").home} href={(path) => path} />
    </div>
  );
}
