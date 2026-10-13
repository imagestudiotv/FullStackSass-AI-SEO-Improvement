import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";

import { ToolsHub } from "../../tools/tools-hub";

/** The free tools hub in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tools">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { hub } = TOOLS_COMMON[locale];
  return { title: hub.metaTitle, description: hub.metaDescription, ...publicPageMetadata("/tools", { locale }) };
}

export default async function LocalisedToolsPage({ params }: PageProps<"/[locale]/tools">) {
  const { locale } = await params;
  // English lives at /tools.
  if (!isLocale(locale) || locale === "en") notFound();
  return <ToolsHub locale={locale} />;
}
