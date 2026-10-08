import { notFound } from "next/navigation";

import { listPlansForPrebuiltPage } from "@/lib/billing";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { HomePageSections } from "../home-page";

/**
 * Localised homepage: /es, /fr, /it, /de.
 *
 * Renders exactly the same sections as the English page, from the same
 * composition (home-page.tsx). This used to be a separate, much simpler page — one section
 * against the English page's nine — which meant switching language visibly
 * downgraded the site. Sharing the components makes that impossible: a section
 * added to the English homepage appears in every language automatically.
 *
 * hreflang tags tell search engines these are the same page in different
 * languages rather than duplicates competing with each other.
 */

/**
 * Built ahead and refreshed in the background at most hourly, instead of on
 * every visit (client's launch review, 2026-10-03: mobile PageSpeed). Plan
 * prices are the only data here and change rarely; serving a ready-made page
 * from Vercel's edge cuts the server response time PageSpeed weighs heavily.
 * See listPlansForPrebuiltPage for how a build without a database, and a
 * database that fails, are each handled.
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);

  return {
    title: t.home.title,
    description: t.home.subtitle,
    ...publicPageMetadata("/", { locale }),
  };
}

export default async function LocalisedHomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const plans = await listPlansForPrebuiltPage();
  // Keeps every in-page link inside the reader's language.
  const href = (path: string) => localePath(locale, path);

  return <HomePageSections locale={locale} href={href} plans={plans} />;
}
