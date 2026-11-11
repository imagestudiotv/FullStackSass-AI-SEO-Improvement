import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_LOCALE } from "@/lib/i18n/config";

import { loadProfile, profileEngagement, profileMetadata, ProfileView } from "./profile-view";

/**
 * One business's profile, /discover/<slug> (client, 2026-11-11 round 2;
 * lib/discover/profiles.ts): a published Customer stories post with that
 * profile address. Anything else - an unknown address, a draft, a post in
 * another category - is a 404. Per request, like the blog's posts.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(DEFAULT_LOCALE, slug);
  if (!profile) return { title: "Business not found" };
  return profileMetadata(profile, DEFAULT_LOCALE);
}

export default async function DiscoverProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await loadProfile(DEFAULT_LOCALE, slug);
  if (!profile) notFound();
  return <ProfileView profile={profile} locale={DEFAULT_LOCALE} initial={await profileEngagement(profile.postId)} />;
}
