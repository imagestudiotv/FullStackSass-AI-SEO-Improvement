import { notFound } from "next/navigation";

import { homeCustomerStories } from "@/lib/blog/engagement";
import { countContentCreated } from "@/lib/marketing/content-count";
import { listPublishedTestimonials } from "@/lib/marketing/testimonials-db";
import { listPlansForPrebuiltPage } from "@/lib/billing";
import { isLocale, localePath } from "@/lib/i18n/config";
import { HOME_META } from "@/lib/seo/home-metadata";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { HomePageSections } from "@/app/(marketing)/home-page";

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
 * every visit (client's launch review, 2026-10-03: mobile PageSpeed). The
 * reviews, the content count and the plans are the only data here and change rarely;
 * serving a ready-made page from Vercel's edge cuts the server response time
 * PageSpeed weighs heavily.
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  // The same wording as the English homepage, translated (lib/seo/home-metadata.ts).
  return {
    title: { absolute: HOME_META[locale].title },
    description: HOME_META[locale].description,
    ...publicPageMetadata("/", { locale }),
  };
}

export default async function LocalisedHomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const [plans, testimonials, contentCount, customerStories] = await Promise.all([
    listPlansForPrebuiltPage(),
    listPublishedTestimonials(),
    countContentCreated(),
    homeCustomerStories(locale),
  ]);
  // Keeps every in-page link inside the reader's language.
  const href = (path: string) => localePath(locale, path);

  return (
    <HomePageSections
      locale={locale}
      href={href}
      testimonials={testimonials}
      contentCount={contentCount}
      plans={plans}
      customerStories={customerStories}
    />
  );
}
