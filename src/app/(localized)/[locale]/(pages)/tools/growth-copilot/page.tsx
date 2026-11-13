import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";

import { GrowthCopilotTool, growthCopilotMetadata } from "@/app/(marketing)/tools/growth-copilot/tool";

/** The Growth Copilot in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/growth-copilot">) {
  const { locale } = await params;
  return isLocale(locale) ? growthCopilotMetadata(locale) : {};
}

export default async function LocalisedGrowthCopilotPage({ params }: PageProps<"/[locale]/tools/growth-copilot">) {
  const { locale } = await params;
  // English lives at /tools/growth-copilot.
  if (!isLocale(locale) || locale === "en") notFound();
  return <GrowthCopilotTool locale={locale} />;
}
