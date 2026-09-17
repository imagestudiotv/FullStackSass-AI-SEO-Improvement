"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the sidebar while someone is in setup.
 *
 * The client's instruction is explicit: "for onboarding we keep the left menu
 * completely off and focus attention to onboarding steps". It is the right
 * call — every item in that menu leads away from the one thing the screen is
 * asking for, and half of them do not work yet because the website they need
 * does not exist.
 *
 * A client component wrapping the sidebar rather than a separate layout,
 * because the app layout is a server component with no access to the
 * pathname, and moving onboarding out from under it would mean rebuilding the
 * header, the notification bell and the session guard for one flow.
 *
 * Returns null rather than hiding with CSS, so the markup is not in the page
 * at all and nothing inside it can take focus or be read out. The server work
 * behind `children` still happens either way — it is evaluated by the layout
 * before this component sees it — which is fine: those queries already run for
 * the header on the same request.
 */
export function AppSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  /**
   * Prefix match, so every step is covered without listing them. "/onboarding"
   * itself is the checklist, which also reads better without the menu beside
   * it repeating the same links.
   */
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
      <div className="sticky top-14 py-4">{children}</div>
    </aside>
  );
}
