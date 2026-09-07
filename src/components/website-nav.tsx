"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WEBSITE_SECTIONS, sectionHref } from "@/lib/websites/sections";

/**
 * Sub-navigation for one website.
 *
 * A client component because the active item comes from the current path, and
 * the alternative — passing it down from every page — means eight places that
 * can disagree about which one is highlighted.
 *
 * Horizontal and scrollable below `lg`, a column beside the content above it.
 * A second fixed sidebar on a phone would leave almost nothing for the panel
 * it is meant to be navigating.
 */
export function WebsiteNav({ websiteId }: { websiteId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Website sections" className="lg:w-56 lg:shrink-0">
      <ul
        className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
        // The row scrolls sideways on small screens; without this the labels
        // wrap and the bar becomes three lines tall.
      >
        {WEBSITE_SECTIONS.map((section) => {
          const href = sectionHref(websiteId, section.segment);
          /**
           * The index is only active on an exact match. Using startsWith would
           * light it up on every child route, so two items would look active
           * at once.
           */
          const active =
            section.segment === ""
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={section.segment || "index"} className="shrink-0 lg:shrink">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={section.description}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors lg:whitespace-normal ${
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <section.icon className="size-4 shrink-0" aria-hidden="true" />
                {section.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
