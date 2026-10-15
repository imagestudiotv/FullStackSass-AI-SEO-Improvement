import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { blogPage } from "@/lib/blog/pagination";
import { isLocale, type Locale } from "@/lib/i18n/config";

import { teamAuthorMetadata, teamAuthorPage } from "../../../../blog/author/team-author";

/**
 * The RepGet team's author page in another language than English:
 * /it/blog/author/repget-team (client, 2026-10-15). The team's name,
 * description and posts in that language; the page is
 * app/(marketing)/blog/author/team-author.tsx, shared with the English one.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

async function language(params: Props["params"]): Promise<Exclude<Locale, "en">> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();
  return locale;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return teamAuthorMetadata(await language(params), blogPage((await searchParams).page));
}

export default async function LocaleTeamAuthorPage({ params, searchParams }: Props) {
  return teamAuthorPage({ locale: await language(params), page: blogPage((await searchParams).page) });
}
