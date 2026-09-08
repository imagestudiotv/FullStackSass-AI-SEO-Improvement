import { notFound } from "next/navigation";

import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
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
    alternates: {
      canonical: localePath(locale, "/faq"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/faq")]),
      ),
    },
  };
}

export default async function LocalisedFaqPage({
  params,
}: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  return <FaqContent t={getMessages(locale)} />;
}
