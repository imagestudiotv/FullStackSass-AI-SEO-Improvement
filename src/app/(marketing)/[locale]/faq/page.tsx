import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { FaqContent } from "../../static-pages";

/** Localised FAQ: /es/faq, /fr/faq, /it/faq, /de/faq. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.faq.metaTitle,
    description: t.faq.metaDescription,
    ...publicPageMetadata("/faq", { locale }),
  };
}

export default async function LocalisedFaqPage({
  params,
}: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  return <FaqContent t={getMessages(locale)} />;
}
