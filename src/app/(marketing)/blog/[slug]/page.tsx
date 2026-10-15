import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogSponsorship } from "@/components/blog-sponsorship";
import { getPost, postVersions, relatedPosts } from "@/lib/blog/posts";
import { sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { SPONSORSHIP_COPY } from "@/lib/blog/sponsorship-copy";

import { BlogPostView, postMetadata } from "../post-view";

/**
 * Rendered per request, from the database: a post published or corrected in
 * the admin panel is live at once, and a build never needs the database. The
 * homepage renders the same way for its live prices.
 *
 * English posts only; the other languages are at /<locale>/blog/<slug>
 * (app/(marketing)/[locale]/blog). Both draw the post with post-view.tsx.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return { title: "Post not found" };
  return postMetadata(post, await postVersions(slug, "en"));
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

  const [related, versions] = await Promise.all([relatedPosts(post), postVersions(slug, "en")]);

  return (
    <BlogPostView
      post={post}
      versions={versions}
      related={related}
      sponsorship={
        <BlogSponsorship
          slug={post.slug}
          locale="en"
          enabled={sponsorshipConfigured()}
          copy={SPONSORSHIP_COPY.en.panel}
          contactHref="/contact"
          cancelled={cancelled}
        />
      }
    />
  );
}
