"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Backlinks sections for one website. A plain list of links (not tabs): each
 * is its own page with its own URL, so back/forward, refresh and sharing a
 * link all land on the same view. The active one carries aria-current.
 */
export function BacklinksSubnav({
  websiteId,
  labels,
}: {
  websiteId: string;
  labels: { nav: string; overview: string; earned: string; hosted: string; credits: string };
}) {
  const pathname = usePathname();
  const base = `/websites/${websiteId}/backlinks`;
  const items = [
    { href: base, label: labels.overview, exact: true },
    { href: `${base}/links`, label: labels.earned },
    { href: `${base}/hosted`, label: labels.hosted },
    { href: `${base}/credits`, label: labels.credits },
  ];
  return (
    <nav aria-label={labels.nav} className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
