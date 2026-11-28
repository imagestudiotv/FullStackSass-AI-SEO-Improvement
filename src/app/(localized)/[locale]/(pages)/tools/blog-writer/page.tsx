import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";

import { BlogWriterTool, blogWriterMetadata } from "@/app/(marketing)/tools/blog-writer/tool";

/** The free AI Blog Writer in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/blog-writer">) {
  const { locale } = await params;
  return isLocale(locale) ? blogWriterMetadata(locale) : {};
}

export default async function LocalisedBlogWriterPage({ params }: PageProps<"/[locale]/tools/blog-writer">) {
  const { locale } = await params;
  // English lives at /tools/blog-writer.
  if (!isLocale(locale) || locale === "en") notFound();
  return <BlogWriterTool locale={locale} />;
}
