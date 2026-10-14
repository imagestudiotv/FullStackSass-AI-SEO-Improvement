"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isLocale, localePath, splitLocale, type Locale } from "@/lib/i18n/config";

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
 *
 * It goes to the homepage in the page's own language: from /de/pricing to
 * /de, not to the English homepage (client, 2026-10-13).
 *
 * Its screen-reader name is in that language too when the caller passes
 * `labels` (the public site's header does, from lib/i18n/site-chrome.ts -
 * never messages.ts in this client file); otherwise it stays English.
 */
export function BrandHomeLink({
  children,
  className,
  locale = "",
  labels,
}: {
  children: ReactNode;
  className?: string;
  /** Locale prefix; by default the language of the current address, so /es stays in Spanish. */
  locale?: string;
  /** The link's aria-label in each language; "RepGet home" where one is missing. */
  labels?: Partial<Record<Locale, string>>;
}) {
  const pathname = usePathname();
  const language = locale && isLocale(locale) ? locale : splitLocale(pathname).locale;
  const home = locale ? `/${locale}` : localePath(language, "/");
  const atHome = pathname === home;

  return (
    <Link
      href={home}
      aria-label={labels?.[language] ?? "RepGet home"}
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
