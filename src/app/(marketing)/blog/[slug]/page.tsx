import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogArticle } from "@/components/blog-article";
import { getPost, relatedPosts } from "@/lib/blog/posts";
import { jsonLdScript } from "@/lib/blog/shared";
import { SHARE_IMAGE } from "@/lib/share-image";

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

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      /*
        Named explicitly: setting openGraph here replaces the root layout's,
        which drops the site picture Next would otherwise attach. Posts have
        no picture of their own. See lib/share-image.ts.
      */
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [SHARE_IMAGE],
    },
  };
}

export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
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
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      articleSection: post.category,
      author: { "@type": "Organization", name: post.author },
    },
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
          // Structured data wants text, not markup.
          text: faq.answer.replace(/<[^>]+>/g, ""),
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
            {post.title}
          </span>
        </nav>

        <BlogArticle post={post} />

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

      {/* The blog exists to bring people into the product, so it says so. */}
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl bg-foreground px-6 py-12 text-center text-background">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            See how your own site is doing
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty opacity-80">
            We read your pages and show you what is holding you back - on Google
            and with AI assistants. Free, no account needed.
          </p>
          <Link
            href="/audit"
            className="mt-7 inline-flex h-11 items-center rounded-full bg-primary px-7 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Check my website
          </Link>
        </div>
      </div>
    </div>
  );
}
