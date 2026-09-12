"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { navItems } from "@/lib/nav-items";
import { selectWebsite } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";
import { sectionHref } from "@/lib/websites/sections";

/**
 * The main sidebar.
 *
 * One flat list. A website's sections used to nest under a "Websites" parent
 * and appear only while a site was open, which buried the pages a customer
 * opens daily and left the sidebar nearly empty everywhere else.
 *
 * The per-website items resolve against the selected website, so they work
 * from any page — including /dashboard and /settings, which do not name a
 * site in their own URL.
 */

/** The id from /websites/<id>/..., or null anywhere else. */
function websiteIdFrom(pathname: string): string | null {
  const match = /^\/websites\/([^/]+)/.exec(pathname);
  if (!match) return null;

  /**
   * "new" is the add-a-website route, not an id. Without this the per-site
   * links would point at /websites/new/content, which 404s.
   */
  return match[1] === "new" ? null : match[1];
}

export function SidebarNav({
  onNavigate,
  onboardingComplete = false,
  selectedWebsiteId = null,
}: {
  onNavigate?: () => void;
  /**
   * The website the per-site links point at when the URL does not name one.
   *
   * Resolved on the server from the address, then the remembered choice, then
   * the customer's first website. Passed in rather than worked out here
   * because /dashboard carries the site in a query parameter and /settings
   * carries it nowhere.
   */
  selectedWebsiteId?: string | null;
  /**
   * Hides "Get started" once setup is finished. The routes stay — they hold
   * plan selection and checkout — but a permanent link to a finished
   * checklist is clutter every customer carries forever.
   */
  onboardingComplete?: boolean;
}) {
  const pathname = usePathname();
  const fromPath = websiteIdFrom(pathname);
  // The URL still wins: someone on /websites/abc/google is looking at abc
  // whatever they last chose in the switcher.
  const websiteId = fromPath ?? selectedWebsiteId;

  /**
   * Record the website when the address names one.
   *
   * Done here rather than in the website layout because Next only allows
   * cookies to be written from a server action, and a layout is not one.
   * Without it, opening a site's page and then going to Settings would fall
   * back to whichever site was last picked in the switcher.
   *
   * Skipped when it already matches, so ordinary navigation inside one
   * website does not post on every page change.
   */
  useEffect(() => {
    if (!fromPath || fromPath === selectedWebsiteId) return;
    void selectWebsite(fromPath);
  }, [fromPath, selectedWebsiteId]);

  const items = navItems.filter((item) => {
    if (item.href === "/onboarding" && onboardingComplete) return false;
    /**
     * No website yet, so every per-site link would 404. Dashboard and
     * Settings still work, and the dashboard already prompts for a site.
     */
    if (item.segment !== undefined && !websiteId) return false;
    return true;
  });

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {items.map((item) => {
        const Icon = item.icon;

        const href =
          item.segment !== undefined && websiteId
            ? sectionHref(websiteId, item.segment)
            : (item.href as string);

        /**
         * The website index ("" segment) must match exactly. Every other
         * route also matches its own children, so an article page keeps
         * Planned Articles lit rather than dimming the whole sidebar.
         */
        const exact = item.segment === "" || item.href === "/dashboard";
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <div key={item.title}>
            {item.separatorBefore ? (
              <div className="my-2 border-t" role="presentation" />
            ) : null}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.title}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
