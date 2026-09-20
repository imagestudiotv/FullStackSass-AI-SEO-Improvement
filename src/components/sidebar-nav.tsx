"use client";

import { ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

/** One purchasable add-on, as the sidebar needs it. */
export type SidebarAddon = { id: string; name: string };

export function SidebarNav({
  onNavigate,
  onboardingComplete = false,
  selectedWebsiteId = null,
  addons = [],
}: {
  onNavigate?: () => void;
  /**
   * What can be bought, for the Add-ons item to expand into.
   *
   * Passed in rather than fetched here: this is a client component, and the
   * catalogue is rows in a table the server already reads for the layout.
   * Empty by default, which hides the item — a deployment with no add-ons
   * configured should not show an empty menu.
   */
  addons?: SidebarAddon[];
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

  /**
   * Add-ons start open.
   *
   * The point of promoting them out of Billing was that nobody found them;
   * shipping them collapsed by default would hide them again behind one more
   * click. Collapsing is there for someone who does not want the list.
   */
  const [addonsOpen, setAddonsOpen] = useState(true);

  const items = navItems.filter((item) => {
    /*
      "Set up" goes once every REQUIRED launch step is done. The flag is named
      for the old signup checklist it used to hide; it now carries the launch
      state, which is what the item points at.
    */
    if (item.href === "/setup" && onboardingComplete) return false;
    /**
     * No website yet, so every per-site link would 404. Dashboard and
     * Settings still work, and the dashboard already prompts for a site.
     */
    if (item.segment !== undefined && !websiteId) return false;
    /**
     * Nothing to sell, nothing to show. A deployment that has not configured
     * add-ons would otherwise carry a menu item that expands into nothing.
     */
    if (item.expands === "addons" && addons.length === 0) return false;
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
        /**
         * usePathname() never carries a hash, so an href like
         * "/billing#addons" must be compared on its path alone — otherwise
         * the item can never match and never highlights.
         */
        const hrefPath = href.split("#")[0];

        const exact = item.segment === "" || item.href === "/dashboard";
        const active = exact
          ? pathname === hrefPath
          : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);

        /**
         * An expanding item is two controls in one row: the label navigates,
         * the chevron opens the list. Kept separate so clicking "Add-ons"
         * still goes somewhere — a parent that only toggles is a dead end for
         * anyone who wanted the page.
         */
        if (item.expands === "addons") {
          return (
            <div key={item.title}>
              {item.separatorBefore ? (
                <div className="my-2 border-t" role="presentation" />
              ) : null}
              <div
                className={cn(
                  "flex items-center rounded-md transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm",
                    active && "font-medium",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.title}
                </Link>
                <button
                  type="button"
                  onClick={() => setAddonsOpen((open) => !open)}
                  aria-expanded={addonsOpen}
                  aria-controls="sidebar-addons"
                  aria-label={
                    addonsOpen ? "Collapse add-ons" : "Expand add-ons"
                  }
                  className="shrink-0 rounded-md px-2 py-2"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      !addonsOpen && "-rotate-90",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {addonsOpen ? (
                <ul id="sidebar-addons" className="mt-0.5 space-y-0.5">
                  {addons.map((addon) => (
                    <li key={addon.id}>
                      {/*
                        Every add-on links to the same panel rather than to a
                        page of its own: buying one is a Stripe checkout
                        started from there, and inventing a route per add-on
                        would be a page whose only content is a button.
                      */}
                      <Link
                        href="/billing#addons"
                        onClick={onNavigate}
                        className="flex items-start gap-3 rounded-md py-1.5 pl-9 pr-3 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
                      >
                        <Package
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">{addon.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        }

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
