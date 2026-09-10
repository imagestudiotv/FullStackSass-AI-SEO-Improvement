"use client";

import { Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { selectWebsite } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";

/**
 * Picks which website the dashboard is showing.
 *
 * A menu rather than tabs: the plans go up to ten sites, and ten tabs would
 * wrap onto a second row and push the panels down the page. It also carries
 * "Add website", which the brief asks for in the same place — the moment
 * someone opens this list is the moment they notice one is missing.
 */
export function WebsiteSwitcher({
  websites,
  current,
  compact = false,
}: {
  websites: { id: string; domain: string; brandName: string | null }[];
  current: { id: string; domain: string; brandName: string | null };
  /** Smaller, for the header, where it sits beside the workspace picker. */
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Prefer the website in the address over the one passed in.
   *
   * The prop comes from a cookie the sidebar writes after the page renders,
   * so on the first load of a website page it still names the previous site —
   * the header would say "First Site" while the sidebar showed the second
   * one's sections. Reading the URL here keeps the two labels in step.
   */
  const fromPath = /^\/websites\/([0-9a-f-]{36})/.exec(pathname)?.[1];
  const active = websites.find((site) => site.id === fromPath) ?? current;

  /**
   * Close on a click outside, or on Escape.
   *
   * This was a full-screen button behind the menu, which stopped working when
   * the switcher moved into the header: the header has backdrop-blur, and
   * backdrop-filter makes an element a containing block for fixed children.
   * The "full-screen" backdrop was therefore the size of the header, so
   * clicking the page below never reached it and the menu stayed open.
   *
   * A pointerdown listener has no such problem — it does not care where in the
   * tree the menu lives.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Remember the choice, then go where it applies.
   *
   * Saved server-side because the sidebar's sections are rendered on the
   * server and need the answer before the page paints. Without this the
   * sections disappeared as soon as you left a website page, even though the
   * switcher still named a site.
   *
   * On a website page we move to the same section of the newly chosen site,
   * so switching from Image Studio's publishing settings lands on the other
   * site's publishing settings rather than throwing you back to a dashboard.
   */
  function choose(id: string) {
    setOpen(false);
    if (id === active.id) return;

    startTransition(async () => {
      await selectWebsite(id);

      const section = /^\/websites\/[^/]+(\/.*)?$/.exec(pathname);
      if (section) {
        router.push(`/websites/${id}${section[1] ?? ""}`);
      } else {
        // A query parameter, not a route: the dashboard is one page showing
        // one site at a time.
        router.push(id === websites[0]?.id ? "/dashboard" : `/dashboard?site=${id}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="outline"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className={cn(
          "gap-2 font-medium",
          compact
            ? "h-8 rounded-md px-2 text-sm"
            : "h-11 rounded-full pl-3 pr-2 text-base",
        )}
      >
        <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className={cn("truncate", compact ? "max-w-40" : "max-w-[16rem]")}>
          {active.brandName || active.domain}
        </span>
        <ChevronsUpDown
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </Button>

      {open ? (
        <div
            role="listbox"
            className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-popover p-1 shadow-md"
          >
            {websites.map((site) => (
              <button
                key={site.id}
                type="button"
                role="option"
                aria-selected={site.id === active.id}
                onClick={() => choose(site.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  site.id === active.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60",
                )}
              >
                <Globe
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">
                  {site.brandName || site.domain}
                </span>
                {site.id === active.id ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            ))}

            <div className="my-1 h-px bg-border" />

            <Link
              href="/websites/new"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/60"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              Add a website
            </Link>
        </div>
      ) : null}
    </div>
  );
}
