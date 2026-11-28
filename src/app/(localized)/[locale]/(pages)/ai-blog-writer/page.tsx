import { notFound } from "next/navigation";

import { listPlansForPrebuiltPage } from "@/lib/billing";
import { repgetOfferEnabled } from "@/lib/billing/repget-offer";
import { AI_BLOG_WRITER_PATH, aiBlogWriterCopy } from "@/lib/i18n/ai-blog-writer";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { AiBlogWriterPageContent } from "@/app/(marketing)/ai-blog-writer-page";

/** /ai-blog-writer in Spanish, French, Italian and German: the English page's layout, translated copy. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

/** As the English page: built ahead, its plan prices refreshed at most hourly. */
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-blog-writer">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = aiBlogWriterCopy(locale);
  return { title: t.metaTitle, description: t.metaDescription, ...publicPageMetadata(AI_BLOG_WRITER_PATH, { locale }) };
}

export default async function LocalisedPage({ params }: PageProps<"/[locale]/ai-blog-writer">) {
  const { locale } = await params;
  // English lives at /ai-blog-writer.
  if (!isLocale(locale) || locale === "en") notFound();
  const plans = await listPlansForPrebuiltPage();
  return <AiBlogWriterPageContent locale={locale} plans={plans} offer={repgetOfferEnabled()} />;
}
