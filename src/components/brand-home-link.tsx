"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The header logo, which also scrolls back to the top.
 *
 * `<Link href="/">` does nothing when you are already on "/" — Next sees the
 * same route and skips the navigation, and because the header is sticky the
 * page stays exactly where it was. Clicking the logo halfway down the homepage
 * therefore appeared broken, which is the report: "if I click on logo to go up
 * on homepage is not moving".
 *
 * On any other page it stays an ordinary link, so a normal navigation to the
 * homepage still works and still arrives at the top.
 */
export function BrandHomeLink({
  children,
  className,
  locale = "",
}: {
  children: ReactNode;
  className?: string;
  /** Locale prefix, so /es stays in Spanish rather than jumping to English. */
  locale?: string;
}) {
  const pathname = usePathname();
  const home = locale ? `/${locale}` : "/";
  const atHome = pathname === home;

  return (
    <Link
      href={home}
      aria-label="RepGet home"
      className={className}
      onClick={(event) => {
        if (!atHome) return;
        /**
         * Already home: take over and scroll instead. preventDefault stops
         * the hash-less navigation that would otherwise do nothing at all.
         */
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {children}
    </Link>
  );
}
