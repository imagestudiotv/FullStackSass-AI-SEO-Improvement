"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { WEBSITE_SECTIONS, sectionHref } from "@/lib/websites/sections";

/**
 * The main sidebar.
 *
 * A website's own sections nest under Websites rather than living in a second
 * column beside the content. One navigation is easier to scan than two, and it
 * keeps the whole hierarchy visible: which site you are in, and which part of
 * it, without looking in two places.
 *
 * The sections appear only while a website is open. Listing eight per-site
 * links with no site selected would be eight dead entries, and showing them
 * for every site the customer owns would make the sidebar unusable on a Scale
 * plan with ten sites.
 */

/** The id from /websites/<id>/..., or null anywhere else. */
function websiteIdFrom(pathname: string): string | null {
  const match = /^\/websites\/([^/]+)/.exec(pathname);
  if (!match) return null;

  /**
   * "new" is the add-a-website route, not an id. Without this the sub-menu
   * appears on that page pointing at /websites/new/content, which 404s.
   */
  return match[1] === "new" ? null : match[1];
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const websiteId = websiteIdFrom(pathname);

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {navItems.map((item) => {
        const Icon = item.icon;
        /**
         * Websites stays highlighted while any of its sections is open —
         * without this the parent goes dim the moment you enter a site, and
         * nothing in the sidebar shows where you are.
         */
        const isWebsites = item.href === "/websites";
        const active = isWebsites
          ? pathname === item.href
          : pathname === item.href;
        const withinWebsites = isWebsites && websiteId !== null;

        if (item.disabled) {
          return (
            <span
              key={item.title}
              aria-disabled="true"
              // Shown but not clickable: the feature is coming, and hiding it
              // entirely would make the product look less capable than it is.
              className="flex cursor-not-allowed select-none items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/40"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.title}
            </span>
          );
        }

        return (
          <div key={item.title}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active || withinWebsites
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.title}
            </Link>

            {/* The open website's sections, nested under Websites. */}
            {withinWebsites ? (
              <ul className="mt-0.5 space-y-0.5 border-l pl-4 ml-[1.4rem]">
                {WEBSITE_SECTIONS.map((section) => {
                  const href = sectionHref(websiteId, section.segment);
                  /**
                   * The index matches exactly; the rest also match their own
                   * children. startsWith on the index would light it up on
                   * every section, so two would look active at once.
                   */
                  const sectionActive =
                    section.segment === ""
                      ? pathname === href
                      : pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <li key={section.segment || "index"}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={sectionActive ? "page" : undefined}
                        title={section.description}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          sectionActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                        )}
                      >
                        <section.icon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {section.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
