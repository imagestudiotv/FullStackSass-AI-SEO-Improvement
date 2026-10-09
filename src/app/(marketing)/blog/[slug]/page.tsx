import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogArticle } from "@/components/blog-article";
import { BlogSponsorship } from "@/components/blog-sponsorship";
import { getPost, relatedPosts } from "@/lib/blog/posts";
import { isTeamAuthor, TEAM_AUTHOR_PATH, jsonLdScript, plainText } from "@/lib/blog/shared";
import { sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { SHARE_IMAGE } from "@/lib/share-image";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList, entityIds } from "@/lib/structured-data";

import { ClosingCta } from "../../home-sections";

/**
 * Rendered per request, from the database: a post published or corrected in
 * the admin panel is live at once, and a build never needs the database. The
 * homepage renders the same way for its live prices.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return { title: "Post not found" };

  /*
    The SEO title, when the post has one, is the whole <title>, exactly as
    written (client, 2026-10-08). Without one the title is the article's,
    with "| RepGet" added by the root layout, as every post has always had.
    The visible H1 is the article title either way.
  */
  const searchTitle = post.seoTitle || post.title;

  return {
    title: post.seoTitle ? { absolute: post.seoTitle } : post.title,
    description: post.description,
    /*
      An article rather than a website, titled without the "| RepGet" suffix.
      The helper keeps the site picture (posts have none of their own) and
      sets og:url to the canonical.
    */
    ...publicPageMetadata(`/blog/${post.slug}`, {
      openGraph: {
        type: "article",
        title: searchTitle,
        description: post.description,
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt ?? post.publishedAt,
        authors: [post.author],
      },
    }),
    twitter: {
      card: "summary_large_image",
      title: searchTitle,
      description: post.description,
      images: [SHARE_IMAGE],
    },
  };
}

export default async function BlogPostPage({
  params,
  searchParams,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  // Back from Stripe without paying (lib/blog/sponsorship-actions.ts): the panel says nothing was charged.
  const cancelled = (await searchParams).featured === "cancelled";
  const post = await getPost(slug);

  // A missing slug is a genuine 404, not an empty page: a soft 404 keeps a
  // dead URL in the index indefinitely.
  if (!post) notFound();

  const related = await relatedPosts(post);

  /**
   * Article structured data. This is what lets a post appear as a rich result
   * rather than a plain blue link, and omitting it on an SEO product's own
   * blog would be hard to defend.
   */
  const site = siteUrl();
  const address = `${site}/blog/${post.slug}`;
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: address,
      mainEntityOfPage: address,
      // Posts have no picture of their own; this is the one shared links show.
      image: `${site}${SHARE_IMAGE.url}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      articleSection: post.category,
      /*
        The post's primary and secondary keywords (Admin -> Blog). Only here:
        they are never written into the page as text (lib/blog/keywords.ts).
      */
      keywords: [post.primaryKeyword, ...(post.secondaryKeywords ?? [])].filter(Boolean).join(", ") || undefined,
      // The team's byline links to its author page; the author names the same page.
      author: {
        "@type": "Organization",
        name: post.author,
        ...(isTeamAuthor(post.author) ? { url: `${site}${TEAM_AUTHOR_PATH}` } : {}),
      },
      // The Organization the homepage defines, by reference rather than again.
      publisher: { "@id": entityIds(site).organization },
    },
    // The same trail as the visible breadcrumb below, in the same order.
    breadcrumbList(site, [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.category, path: `/blog/category/${post.categorySlug}` },
      // The label written for the breadcrumb, when there is one (Admin -> Blog).
      { name: post.breadcrumbLabel || post.title, path: `/blog/${post.slug}` },
    ]),
  ];

  /**
   * FAQ structured data, only when the post actually carries questions —
   * an empty FAQPage is a structured data error rather than a missed
   * opportunity.
   */
  if (post.faqs && post.faqs.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          // Structured data wants text, not markup: a line per paragraph or list item.
          text: plainText(faq.answer),
        },
      })),
    });
  }

  return (
    <div>
      <script
        type="application/ld+json"
        // Escaped for a script block: titles and answers are typed by people.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12">
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
          <Link
            href={`/blog/category/${post.categorySlug}`}
            className="text-primary hover:underline"
          >
            {post.category}
          </Link>
          <span aria-hidden="true">/</span>
          {/* Truncates rather than wrapping to three lines on a phone. */}
          <span className="max-w-full truncate text-foreground">
            {post.breadcrumbLabel || post.title}
          </span>
        </nav>

        <BlogArticle
          post={post}
          sponsorship={<BlogSponsorship slug={post.slug} enabled={sponsorshipConfigured()} cancelled={cancelled} />}
        />

        {related.length > 0 ? (
          <nav className="mt-12 rounded-xl border bg-card p-5" aria-label="More posts">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Keep reading
            </p>
            <ul className="mt-3 divide-y">
              {related.map((other) => (
                <li key={other.slug} className="py-3 first:pt-1 last:pb-1">
                  <Link
                    href={`/blog/${other.slug}`}
                    className="font-medium hover:text-primary"
                  >
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* The blog exists to bring people into the product: the homepage's closing panel. */}
      <ClosingCta t={getMessages("en").home} href={(path) => path} />
    </div>
  );
}
