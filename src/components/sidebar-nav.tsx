"use client";

import { ChevronDown, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { navEntries, type NavEntry, type NavGroup, type NavLink } from "@/lib/nav-items";
import type { Messages } from "@/lib/i18n/messages";
import { selectWebsite } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";
import { sectionHref } from "@/lib/websites/sections";

/**
 * The main sidebar (client design, 2026-11-02; groups in lib/nav-items.ts).
 *
 * The per-website items resolve against the selected website, so they work
 * from any page — including /dashboard and /settings, which do not name a
 * site in their own URL.
 *
 * Groups open and close from their heading and REMEMBER it (in this
 * browser), so someone who never uses Growth Audit can fold it away once. The
 * group holding the current page always opens, so the page you are on is
 * never hidden inside a closed group.
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
export type SidebarAddon = {
  id: string;
  name: string;
  /** Its own screen; without one, the panel on Billing. */
  href?: string;
};

const STORAGE_KEY = "repget.sidebar.groups";

type OpenState = Partial<Record<NavGroup["id"], boolean>>;

/** The remembered state as stored (a string, so React can compare snapshots), read like any outside store. */
function storedSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeStored(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function parseStored(raw: string | null): OpenState {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as OpenState) : {};
  } catch {
    return {};
  }
}

function writeStored(state: OpenState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private windows and full storage: the menu still works, it just forgets.
  }
}

export function SidebarNav({
  onNavigate,
  onboardingComplete = false,
  selectedWebsiteId = null,
  addons = [],
  hideAddons = false,
  hideCredits = false,
  setupProgress = null,
  t,
}: {
  /**
   * Hides the Add-ons group whatever the catalogue holds.
   *
   * Set by the layout for someone who owns no website, and while the selected
   * website is one shared with them. Add-ons are bought by - and credited to
   * - the buyer's own workspace, so offering them beside somebody else's site
   * sells credits that can never be spent there.
   */
  hideAddons?: boolean;
  /**
   * Hides the Credits item for someone who owns no website: the websites
   * shared with them spend their owner's credits, and their own workspace has
   * nothing to spend credits on.
   */
  hideCredits?: boolean;
  /** "2/7" beside the Set up item. Null when there is nothing to report. */
  setupProgress?: { done: number; total: number } | null;
  onNavigate?: () => void;
  /** The sidebar's labels, already in the reader's language. */
  t: Messages["app"]["nav"];
  /**
   * What can be bought, for the Add-ons group to list. Passed in: the
   * catalogue is rows in a table the server already reads for the layout.
   * Empty hides the group — a deployment with no add-ons should not show an
   * empty menu.
   */
  addons?: SidebarAddon[];
  /**
   * The website the per-site links point at when the URL does not name one.
   * Resolved on the server from the address, then the remembered choice, then
   * the customer's first website.
   */
  selectedWebsiteId?: string | null;
  /** Hides "Set up" once every required launch step is done. */
  onboardingComplete?: boolean;
}) {
  const pathname = usePathname();
  const fromPath = websiteIdFrom(pathname);
  // The URL still wins: someone on /websites/abc/google is looking at abc
  // whatever they last chose in the switcher.
  const websiteId = fromPath ?? selectedWebsiteId;
  const rememberedRoute = useRef<string | null | undefined>(undefined);

  /**
   * Record the website when the address names one.
   *
   * Done here rather than in the website layout because Next only allows
   * cookies to be written from a server action, and a layout is not one.
   * Skipped when it already matches, so ordinary navigation inside one
   * website does not post on every page change.
   */
  useEffect(() => {
    // A switch updates the cookie before navigation completes. Remember each
    // route once so this effect cannot write the old site back in that gap.
    if (rememberedRoute.current === fromPath) return;
    rememberedRoute.current = fromPath;
    if (!fromPath || fromPath === selectedWebsiteId) return;
    void selectWebsite(fromPath).catch(() => {
      // The current route still works; let a later route visit retry.
    });
  }, [fromPath, selectedWebsiteId]);

  function hrefOf(item: NavLink): string | null {
    if (item.segment !== undefined) return websiteId ? sectionHref(websiteId, item.segment) : null;
    return item.href ?? null;
  }

  /**
   * The website index ("" segment) and /dashboard match exactly; every other
   * route also matches its own children, so an article page keeps Planned
   * Articles lit. usePathname() never carries a hash, so "/billing#addons"
   * is compared on its path alone.
   */
  function isActive(item: NavLink): boolean {
    if (item.alsoActive?.(pathname)) return true;
    const href = hrefOf(item);
    if (!href) return false;
    const path = href.split("#")[0];
    const exact = item.segment === "" || item.href === "/dashboard";
    return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  }

  function visible(item: NavLink): boolean {
    /* "Set up" goes once every REQUIRED launch step is done. */
    if (item.href === "/setup" && onboardingComplete) return false;
    /* No website yet, so every per-site link would 404. */
    if (item.segment !== undefined && !websiteId) return false;
    if (item.href === "/credits" && hideCredits) return false;
    return true;
  }

  function childrenOf(group: NavGroup): NavLink[] | SidebarAddon[] {
    if (group.children === "addons") return hideAddons ? [] : addons;
    return group.children.filter(visible);
  }

  const activeGroup = navEntries.find(
    (entry): entry is NavEntry & { kind: "group" } =>
      entry.kind === "group" && entry.children !== "addons" && entry.children.some((child) => visible(child) && isActive(child)),
  )?.id;

  /**
   * Open or closed per group: the defaults on the server and the first paint
   * (so the markup matches), then what this browser remembered.
   */
  const storedRaw = useSyncExternalStore(subscribeStored, storedSnapshot, () => null);
  const stored = useMemo(() => parseStored(storedRaw), [storedRaw]);
  const [changed, setChanged] = useState<OpenState>({});
  const open: OpenState = { ...stored, ...changed };

  function toggle(id: NavGroup["id"], isOpen: boolean) {
    const next = { ...open, [id]: !isOpen };
    setChanged(next);
    writeStored(next);
  }

  const linkClass = (active: boolean, child: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 text-sm transition-colors",
      child ? "py-1.5 pl-9" : "py-2",
      active
        ? "bg-accent font-medium text-accent-foreground"
        : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
    );

  function renderLink(item: NavLink, child: boolean) {
    const href = hrefOf(item);
    if (!href) return null;
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link key={item.title} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={linkClass(active, child)}>
        <Icon className={cn("shrink-0", child ? "size-3.5" : "size-4", active && "text-primary")} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t[item.title]}</span>
        {/* Progress beside "Set up", only while there is progress to report. */}
        {item.href === "/setup" && setupProgress ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
            {setupProgress.done}/{setupProgress.total}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label={t.main}>
      {navEntries.map((entry) => {
        if (entry.kind === "link") {
          if (!visible(entry)) return null;
          return (
            <div key={entry.title}>
              {entry.separatorBefore ? <div className="my-2 border-t" role="presentation" /> : null}
              {renderLink(entry, false)}
            </div>
          );
        }

        const children = childrenOf(entry);
        if (children.length === 0) return null;
        const isOpen = entry.id === activeGroup || (open[entry.id] ?? entry.defaultOpen);
        const listId = `sidebar-group-${entry.id}`;
        const Icon = entry.icon;

        return (
          <div key={entry.id} className="mt-1 first:mt-0">
            <button
              type="button"
              onClick={() => toggle(entry.id, isOpen)}
              aria-expanded={isOpen}
              aria-controls={listId}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent/60"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t[entry.title]}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} aria-hidden="true" />
            </button>
            {isOpen ? (
              <div id={listId} className="mt-0.5 mb-1 flex flex-col gap-0.5">
                {entry.children === "addons"
                  ? (children as SidebarAddon[]).map((addon) => (
                      /*
                        An add-on links to the panel on Billing, where it is
                        bought, unless it has a screen of its own (website
                        projects).
                      */
                      <Link
                        key={addon.id}
                        href={addon.href ?? "/billing#addons"}
                        onClick={onNavigate}
                        className="flex items-start gap-3 rounded-md py-1.5 pr-3 pl-9 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
                      >
                        <Package className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{addon.name}</span>
                      </Link>
                    ))
                  : (children as NavLink[]).map((child) => renderLink(child, true))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
