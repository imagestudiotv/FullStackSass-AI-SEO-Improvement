import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogSponsorship } from "@/components/blog-sponsorship";
import { getPost, postVersions, relatedPosts } from "@/lib/blog/posts";
import { sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { SPONSORSHIP_COPY } from "@/lib/blog/sponsorship-copy";
import { isLocale, localePath } from "@/lib/i18n/config";

import { BlogPostView, postMetadata } from "../../../blog/post-view";

/**
 * A post in another language than English: /it/blog/<slug> (client,
 * 2026-10-09; lib/blog/locale.ts). Per request, like the English posts. A
 * slug answers only in its own language: /it/blog/<an English slug> is a
 * 404, never the English post under an Italian address.
 *
 * With "Get Featured in This Article" in the post's language (client,
 * 2026-10-15), as on the English posts.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ featured?: string | string[] }> };

async function find(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || locale === "en") return null;
  const post = await getPost(slug, locale);
  return post ? { post, locale } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await find(params);
  if (!found) return { title: "Post not found" };
  return postMetadata(found.post, await postVersions(found.post.slug, found.locale));
}

export default async function LocaleBlogPostPage({ params, searchParams }: Props) {
  const found = await find(params);
  if (!found) notFound();
  // Back from Stripe without paying (lib/blog/sponsorship-actions.ts): the panel says nothing was charged.
  const cancelled = (await searchParams).featured === "cancelled";
  const [related, versions] = await Promise.all([relatedPosts(found.post), postVersions(found.post.slug, found.locale)]);
  return (
    <BlogPostView
      post={found.post}
      versions={versions}
      related={related}
      sponsorship={
        <BlogSponsorship
          slug={found.post.slug}
          locale={found.locale}
          enabled={sponsorshipConfigured()}
          copy={SPONSORSHIP_COPY[found.locale].panel}
          contactHref={localePath(found.locale, "/contact")}
          cancelled={cancelled}
        />
      }
    />
  );
}
