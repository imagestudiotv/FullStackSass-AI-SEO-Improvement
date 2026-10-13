import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { RobotsTool, robotsMetadata } from "../../../tools/robots-checker/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/robots-checker">) {
  const { locale } = await params;
  return isLocale(locale) ? robotsMetadata(locale) : {};
}

/** /tools/robots-checker in Spanish, French, Italian and German. */
export default async function LocalisedRobotsCheckerPage({ params, searchParams }: PageProps<"/[locale]/tools/robots-checker">) {
  const { locale } = await params;
  // English lives at /tools/robots-checker.
  if (!isLocale(locale) || locale === "en") notFound();
  return <RobotsTool locale={locale} searchParams={await searchParams} />;
}
