import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { loadProfile, profileEngagement, profileMetadata, ProfileView } from "@/app/(marketing)/discover/[slug]/profile-view";

/**
 * A business's profile in another language: /it/discover/<slug>. The
 * Italian customer story's profile where there is one, otherwise the English
 * one in the Italian page (lib/discover/profiles.ts), which then names the
 * English page as its canonical.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function find(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || locale === "en") return null;
  const profile = await loadProfile(locale, slug);
  return profile ? { profile, locale } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await find(params);
  if (!found) return { title: "Business not found" };
  return profileMetadata(found.profile, found.locale);
}

export default async function LocaleDiscoverProfilePage({ params }: Props) {
  const found = await find(params);
  if (!found) notFound();
  return <ProfileView profile={found.profile} locale={found.locale} initial={await profileEngagement(found.profile.postId)} />;
}
