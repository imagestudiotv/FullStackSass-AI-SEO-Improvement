import type { Metadata } from "next";

import { MarketingShell } from "@/components/marketing-shell";
import { NotFoundPanel } from "@/components/not-found-panel";

/**
 * "Page not found" for an address that matches no route at all (/a/b/c,
 * /es/no-such-page), and for a notFound() in a part of the app with no
 * not-found page of its own. Rendered outside every route group's layout, so
 * it brings the public site's header and footer itself. The signed-in app
 * keeps its own (app/(app)/not-found.tsx).
 */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundPanel />
    </MarketingShell>
  );
}
