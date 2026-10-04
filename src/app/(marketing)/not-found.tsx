import type { Metadata } from "next";

import { NotFoundPanel } from "@/components/not-found-panel";

/**
 * "Page not found" for the public site (client's launch review, 2026-10-03),
 * inside its header and footer: an unknown blog post, docs page or language
 * prefix (/xx), or any one-segment address (/anything), which reaches the
 * [locale] layout and is refused there.
 *
 * Answered with a real 404 status - nothing above the public pages streams
 * (no loading.tsx), and a streamed not-found would go out as 200 - so search
 * engines drop the address; Next also adds a noindex tag.
 */
export const metadata: Metadata = { title: "Page not found" };

export default function MarketingNotFound() {
  return <NotFoundPanel />;
}
