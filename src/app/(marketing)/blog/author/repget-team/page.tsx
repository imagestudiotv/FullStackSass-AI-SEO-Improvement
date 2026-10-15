import type { Metadata } from "next";

import { blogPage } from "@/lib/blog/pagination";

import { teamAuthorMetadata, teamAuthorPage } from "../team-author";

/**
 * The RepGet team's author page in English. The page itself, shared with
 * /it/blog/author/repget-team and the other languages, is ../team-author.tsx.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return teamAuthorMetadata("en", blogPage((await searchParams).page));
}

export default async function TeamAuthorPage({ searchParams }: Props) {
  return teamAuthorPage({ locale: "en", page: blogPage((await searchParams).page) });
}
