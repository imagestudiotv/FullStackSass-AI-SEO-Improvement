import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdmin } from "@/lib/admin/guard";
import { listPlansForPrebuiltPage } from "@/lib/billing";
import { isLocale, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { listTestimonialsForPreview } from "@/lib/marketing/testimonials-db";

import { HomePageSections } from "../../home-page";

/**
 * A DESIGN PREVIEW of the homepage with EVERY testimonial card from Admin ->
 * Testimonials - drafts and the client's sample cards included - so the
 * section can be seen in place, in the real design, before a card goes live.
 *
 * Administrators only: anyone else gets the ordinary 404, and search engines
 * are told not to index or follow it. The public homepage shows published
 * cards only (lib/marketing/testimonials-db.ts). ?lang=it (es, fr, de) shows
 * the page around the cards in that language.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Testimonials design preview",
  robots: { index: false, follow: false },
};

export default async function TestimonialsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  if (!(await isAdmin())) notFound();

  const lang = (await searchParams).lang;
  const locale: Locale = typeof lang === "string" && isLocale(lang) ? lang : "en";
  const [plans, cards] = await Promise.all([listPlansForPrebuiltPage(), listTestimonialsForPreview()]);
  const drafts = cards.filter((card) => !card.published).length;

  return (
    <>
      <div className="sticky top-14 z-30 border-b border-warning/40 bg-warning-soft px-4 py-2.5 text-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5">
          <p className="font-medium text-warning">
            Design preview - every testimonial card, drafts included ({cards.length - drafts} published, {drafts}{" "}
            {drafts === 1 ? "draft" : "drafts"}). Only administrators can see this page; the public homepage shows published cards
            only.{" "}
            <Link href="/admin/testimonials" className="underline underline-offset-4">
              Edit them
            </Link>
          </p>
          <span className="flex flex-wrap items-center gap-2">
            <a href="#testimonials" className="font-medium underline underline-offset-4">
              Jump to the testimonials
            </a>
            <span aria-hidden="true">·</span>
            {LOCALES.map((option) => (
              <Link
                key={option}
                href={option === "en" ? "/preview/testimonials" : `/preview/testimonials?lang=${option}`}
                aria-current={option === locale ? "page" : undefined}
                className="rounded px-1 font-medium uppercase underline-offset-4 hover:underline aria-[current=page]:bg-warning/15"
              >
                {option}
              </Link>
            ))}
          </span>
        </div>
      </div>
      <HomePageSections
        locale={locale}
        href={(path) => localePath(locale, path)}
        plans={plans}
        testimonials={cards}
      />
    </>
  );
}
