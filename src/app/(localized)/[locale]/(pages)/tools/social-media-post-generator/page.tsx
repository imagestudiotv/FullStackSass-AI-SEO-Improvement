import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";

import { SocialPostGeneratorTool, socialPostGeneratorMetadata } from "@/app/(marketing)/tools/social-media-post-generator/tool";

/** The AI Social Media Post Generator in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/social-media-post-generator">) {
  const { locale } = await params;
  return isLocale(locale) ? socialPostGeneratorMetadata(locale) : {};
}

export default async function LocalisedSocialMediaPostGeneratorPage({ params }: PageProps<"/[locale]/tools/social-media-post-generator">) {
  const { locale } = await params;
  // English lives at /tools/social-media-post-generator.
  if (!isLocale(locale) || locale === "en") notFound();
  return <SocialPostGeneratorTool locale={locale} />;
}
