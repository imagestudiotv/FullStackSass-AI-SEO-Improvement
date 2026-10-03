"use client";

import { ArrowLeft, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { ADMIN_NAV, activeNavItem, adminCrumbs, SIDEBAR_COOKIE } from "./nav";
import { useReturnFocus } from "./use-return-focus";

/**
 * The admin shell: a charcoal sidebar on desktop (collapsible, remembered in
 * a cookie so the server renders the right width with no jump), a navigation
 * drawer on mobile, a sticky top bar with the breadcrumb trail, the
 * Ctrl/Cmd+K page finder and "Back to app".
 *
 * Presentation only. Who may see any of this is decided on the server: the
 * layout calls requireAdmin() and every action re-checks it.
 */

export type AdminIdentity = { name: string | null; email: string };

export function AdminShell({
  identity,
  initialCollapsed,
  children,
}: {
  identity: AdminIdentity;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const drawerFocus = useReturnFocus();

  // The drawer closes once a link in it has been followed.
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      // A year, scoped to the admin area; read by the layout on the next render.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Ctrl/Cmd+K opens the page finder from anywhere in the admin area.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = adminCrumbs(pathname);

  return (
    <div className="admin-root flex min-h-svh bg-admin-canvas text-foreground">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside
        aria-label="Admin navigation"
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-admin-sidebar-border bg-admin-sidebar text-admin-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav pathname={pathname} collapsed={collapsed} />
        <div className="mt-auto border-t border-admin-sidebar-border p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-admin-sidebar-muted outline-none transition-colors hover:bg-admin-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-primary/60",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />
            )}
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer: focus is trapped while open, Escape closes, focus returns to the menu button. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          closeLabel="Close navigation"
          {...drawerFocus}
          className="w-[280px] max-w-[85vw] gap-0 border-admin-sidebar-border bg-admin-sidebar p-0 text-admin-sidebar-foreground [&_[data-slot=sheet-close]]:text-admin-sidebar-muted [&_[data-slot=sheet-close]]:hover:text-white"
        >
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">Go to another admin page.</SheetDescription>
          <SidebarBrand collapsed={false} />
          <SidebarNav pathname={pathname} collapsed={false} />
          <div className="mt-auto border-t border-admin-sidebar-border p-3">
            <Identity identity={identity} tone="sidebar" />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1 text-sm">
              {crumbs.map((crumb, index) => (
                <li
                  key={crumb.href + crumb.label}
                  className={cn("flex min-w-0 items-center gap-1", index < crumbs.length - 1 && "hidden sm:flex")}
                >
                  {/* Phones show only the current crumb, so its separator would point at nothing. */}
                  {index > 0 ? <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" /> : null}
                  {crumb.current ? (
                    <span aria-current="page" className="truncate font-medium text-foreground">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-52 justify-start gap-2 font-normal text-muted-foreground md:inline-flex"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1 text-left">Go to page…</span>
            <kbd className="rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground">Ctrl K</kbd>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Go to page"
          >
            <Search className="size-5" aria-hidden="true" />
          </Button>

          <Button variant="ghost" size="sm" asChild className="h-9 shrink-0 gap-1.5 text-muted-foreground">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back to app</span>
              <span className="sr-only sm:hidden">Back to app</span>
            </Link>
          </Button>

          <div className="hidden border-l pl-3 xl:block">
            <Identity identity={identity} tone="header" />
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/admin"
      className={cn(
        "flex h-16 shrink-0 items-center gap-2.5 border-b border-admin-sidebar-border px-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
        collapsed && "justify-center px-0",
      )}
      aria-label="RepGet admin overview"
    >
      <BrandMark size={26} />
      {collapsed ? null : (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-semibold text-white">RepGet</span>
          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-primary">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Admin
          </span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const active = activeNavItem(pathname);
  return (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-3">
      {ADMIN_NAV.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-admin-sidebar-border" aria-hidden="true" />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-admin-sidebar-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = active?.href === item.href;
              // The section is "current" on its own page; on a detail page under it, it is the parent.
              const exact = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? (exact ? "page" : "location") : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-admin-sidebar-accent font-medium text-white"
                        : "text-admin-sidebar-foreground/85 hover:bg-admin-sidebar-accent/70 hover:text-white",
                    )}
                  >
                    {isActive ? (
                      <span
                        className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-primary", !exact && "opacity-60")}
                        aria-hidden="true"
                      />
                    ) : null}
                    <item.icon
                      className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-admin-sidebar-muted group-hover:text-white")}
                      aria-hidden="true"
                    />
                    {collapsed ? null : <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Identity({ identity, tone }: { identity: AdminIdentity; tone: "header" | "sidebar" }) {
  const initials = (identity.name || identity.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "header" ? "bg-muted text-foreground" : "bg-admin-sidebar-accent text-white",
        )}
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        {identity.name ? (
          <span className={cn("truncate text-sm font-medium", tone === "sidebar" && "text-white")}>{identity.name}</span>
        ) : null}
        <span className={cn("truncate text-xs", tone === "header" ? "text-muted-foreground" : "text-admin-sidebar-muted")}>
          {identity.email}
        </span>
      </span>
    </div>
  );
}
