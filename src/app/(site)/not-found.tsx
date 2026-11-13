import type { Metadata } from "next";

import { MarketingShell } from "@/components/marketing-shell";
import { NotFoundPanel } from "@/components/not-found-panel";
import { notFoundCopy } from "@/lib/i18n/site-chrome";

/**
 * "Page not found" for a notFound() in a part of the app with no not-found
 * page of its own (admin, invitations, the connect screen...). Its root
 * layout, app/(site)/layout.tsx, has no site frame, so it brings the public
 * site's header and footer itself. The signed-in app keeps its own
 * (app/(site)/(app)/not-found.tsx). An address that matches no route at all
 * (/a/b/c) reaches app/(localized)/[locale] and is answered there.
 */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundPanel copy={notFoundCopy()} />
    </MarketingShell>
  );
}
