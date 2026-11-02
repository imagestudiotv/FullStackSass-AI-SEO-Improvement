"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The desktop sidebar: full height, with the logo, the credits and the
 * website arrows at the top (client design, 2026-11-02), the menu scrolling
 * in the middle, and "Earn Credits" pinned at the bottom.
 *
 * Hidden while someone is in setup — the client's instruction: "for
 * onboarding we keep the left menu completely off and focus attention to
 * onboarding steps". Returns null rather than hiding with CSS, so nothing
 * inside it can take focus or be read out.
 */
export function AppSidebar({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-background md:flex">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">{children}</div>
      {footer}
    </aside>
  );
}

/** The logo in the top bar on desktop only while the sidebar (which carries it) is hidden for setup. */
export function HeaderBrand({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={pathname.startsWith("/onboarding") ? "flex items-center" : "flex items-center md:hidden"}>{children}</div>;
}
