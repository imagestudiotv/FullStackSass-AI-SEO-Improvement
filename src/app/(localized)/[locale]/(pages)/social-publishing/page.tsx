import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, LOCALE_ONLY_PATHS } from "@/lib/i18n/config";
import { SOCIAL_PUBLISHING_PATH, socialPublishingCopy } from "@/lib/marketing/social-publishing";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { SocialPublishingContent } from "@/app/(marketing)/social-publishing-page";

/**
 * /it/social-publishing: the Italian social-publishing landing page
 * (lib/marketing/social-publishing.ts). Only the languages in
 * LOCALE_ONLY_PATHS are built; /es/social-publishing and the rest are 404s,
 * and there is no English page, so no hreflang alternates are declared.
 *
 * NOT INDEXED for now. It is a paid campaign's destination written while the
 * pilot is on hold (Instagram support is for RepGet-made Reels, carousels and
 * Stories, not a general scheduler), so it is kept out of search results and
 * out of the sitemap. Google Ads still reaches it: noindex does not stop an ad
 * from landing there. Remove `robots` to publish it to search.
 */
export function generateStaticParams() {
  return (LOCALE_ONLY_PATHS[SOCIAL_PUBLISHING_PATH] ?? []).map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/social-publishing">): Promise<Metadata> {
  const { locale } = await params;
  const copy = isLocale(locale) ? socialPublishingCopy(locale) : null;
  if (!copy || !isLocale(locale)) return {};
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    robots: { index: false, follow: true },
    ...publicPageMetadata(SOCIAL_PUBLISHING_PATH, { locale }),
  };
}

export default async function SocialPublishingPage({ params }: PageProps<"/[locale]/social-publishing">) {
  const { locale } = await params;
  const copy = isLocale(locale) && LOCALE_ONLY_PATHS[SOCIAL_PUBLISHING_PATH]?.includes(locale) ? socialPublishingCopy(locale) : null;
  if (!copy || !isLocale(locale)) notFound();
  return <SocialPublishingContent copy={copy} locale={locale} />;
}
