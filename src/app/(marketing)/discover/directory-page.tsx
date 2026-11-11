import "server-only";

import type { Metadata } from "next";

import { listDiscoverProfiles } from "@/lib/discover/profiles";
import type { Locale } from "@/lib/i18n/config";
import { DISCOVER_COPY } from "@/lib/i18n/discover";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { DiscoverDirectory } from "./discover-directory";

/** "Growing with RepGet | Customer Directory", in the page's language, with its hreflang. */
export function directoryMetadata(locale: Locale): Metadata {
  const copy = DISCOVER_COPY[locale].directory;
  return {
    title: { absolute: copy.metaTitle },
    description: copy.metaDescription,
    ...publicPageMetadata("/discover", { locale }),
  };
}

/** The directory in a language (lib/discover/profiles.ts listDiscoverProfiles: its stories, else the English ones). */
export async function DirectoryPage({ locale }: { locale: Locale }) {
  const entries = await listDiscoverProfiles(locale);
  return (
    <DiscoverDirectory
      locale={locale}
      copy={DISCOVER_COPY[locale].directory}
      entries={entries.map((entry) => ({
        postId: entry.postId,
        slug: entry.slug,
        name: entry.name,
        tagline: entry.tagline,
        category: entry.category,
        logoUrl: entry.logoUrl,
        websiteUrl: entry.websiteUrl,
        upvotes: entry.upvotes,
        comments: entry.comments,
        views: entry.views,
        publishedAt: entry.publishedAt,
      }))}
    />
  );
}
