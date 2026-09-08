import { notFound } from "next/navigation";

import { SUPPORT_EMAIL } from "@/lib/config/site";
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { ContactContent } from "../../static-pages";

/** Localised contact page: /es/contact and the rest. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.contact.metaTitle,
    description: t.contact.metaDescription,
    alternates: {
      canonical: localePath(locale, "/contact"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/contact")]),
      ),
    },
  };
}

export default async function LocalisedContactPage({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  return <ContactContent t={getMessages(locale)} supportEmail={SUPPORT_EMAIL} />;
}
