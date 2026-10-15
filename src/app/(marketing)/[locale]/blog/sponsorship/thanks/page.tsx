import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/lib/i18n/config";

import { sponsorshipThanksMetadata, sponsorshipThanksPage } from "../../../../blog/sponsorship/thanks-view";

/**
 * Where Stripe sends a buyer after paying for a "Get Featured" placement on
 * an article in another language than English: /it/blog/sponsorship/thanks
 * (client, 2026-10-15). Not a public page: it is not in TRANSLATED_PATHS
 * (no hreflang, not in the sitemap) and asks search engines to keep away.
 * The page is app/(marketing)/blog/sponsorship/thanks-view.tsx.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ session_id?: string | string[] }> };

async function language(params: Props["params"]): Promise<Exclude<Locale, "en">> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();
  return locale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return sponsorshipThanksMetadata(await language(params));
}

export default async function LocaleSponsorshipThanksPage({ params, searchParams }: Props) {
  return sponsorshipThanksPage({ locale: await language(params), sessionId: (await searchParams).session_id });
}
