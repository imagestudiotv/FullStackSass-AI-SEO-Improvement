import { notFound, permanentRedirect } from "next/navigation";

import { SUPPORT_EMAIL, WEBSITE_BUILD_TOPIC, WEBSITE_CREATION_PATH, websiteBuildRedirect } from "@/lib/config/site";
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
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
    ...publicPageMetadata("/contact", { locale }),
  };
}

export default async function LocalisedContactPage({
  params,
  searchParams,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);
  const params = await searchParams;
  // The homepage's old "We'll build one for you" link: that has a page of its own now, in this language.
  if (params.about === WEBSITE_BUILD_TOPIC) {
    permanentRedirect(websiteBuildRedirect(localePath(locale, WEBSITE_CREATION_PATH), params));
  }

  return <ContactContent t={t} locale={locale} supportEmail={SUPPORT_EMAIL} />;
}
