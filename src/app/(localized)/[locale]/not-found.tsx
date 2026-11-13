import type { Metadata } from "next";

import { NotFoundPanel } from "@/components/not-found-panel";
import { notFoundCopy } from "@/lib/i18n/site-chrome";

/**
 * "Page not found" for the translated pages and for any unknown first
 * segment (/xx, /anything, /es/no-such-page), inside this root's frame: the
 * same page as the English one (app/(marketing)/not-found.tsx), which reads
 * its language from the address. Answered with a real 404 status - nothing
 * above streams - and Next adds a noindex tag.
 */
export const metadata: Metadata = { title: "Page not found" };

export default function LocalizedNotFound() {
  return <NotFoundPanel copy={notFoundCopy()} />;
}
