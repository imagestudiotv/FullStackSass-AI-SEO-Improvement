import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { DirectoryPage, directoryMetadata } from "../../discover/directory-page";

/** The customer directory in another language: /it/discover (the English page's design, discover/directory-page.tsx). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return directoryMetadata(locale);
}

export default async function LocalisedDiscoverPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();
  return <DirectoryPage locale={locale} />;
}
