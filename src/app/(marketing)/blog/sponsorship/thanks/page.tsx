import type { Metadata } from "next";

import { sponsorshipThanksMetadata, sponsorshipThanksPage } from "../thanks-view";

/**
 * Where Stripe sends a buyer after paying for a "Get Featured" placement on
 * an English article. The page, shared with /it/blog/sponsorship/thanks and
 * the other languages, is ../thanks-view.tsx.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = sponsorshipThanksMetadata("en");

export default async function SponsorshipThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  return sponsorshipThanksPage({ locale: "en", sessionId: (await searchParams).session_id });
}
