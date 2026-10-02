"use client";

import { Check, ChevronsUpDown, Globe, Plus, Users } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { format } from "@/lib/i18n/format";
import { selectWebsite } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";
// Type-only: erased at compile time, so the server-only module never reaches
// the client bundle.
import type { WebsiteAccess } from "@/lib/websites/accessible";

/**
 * One entry in the menu.
 *
 * `access` is how the reader holds the site: "owner" for their workspace's
 * own, or the role it was shared with them under. Display only - every page
 * the menu leads to asks requireWebsite again - and deliberately nothing
 * about WHO owns a shared site: no workspace id or name ever reaches this
 * client component.
 */
type SwitcherWebsite = {
  id: string;
  domain: string;
  brandName: string | null;
  access: WebsiteAccess;
};

/**
 * Picks which website the dashboard is showing.
 *
 * A menu rather than tabs: the plans go up to ten sites, and ten tabs would
 * wrap onto a second row and push the panels down the page. It also carries
 * "Add website", which the brief asks for in the same place — the moment
 * someone opens this list is the moment they notice one is missing.
 *
 * TWO GROUPS. The workspace's own sites first, then - under "Shared with you"
 * - the ones other people invited this person to, each with its role. The
 * heading and the chips are there so nobody mistakes an invited site for one
 * they own: the role is what decides whether they can delete it, buy for it
 * or invite others to it, and a single undifferentiated list hid that until
 * a button was refused.
 */
export function WebsiteSwitcher({
  websites,
  current,
  compact = false,
  t = getMessages("en").app.dash,
}: {
  /** In display order: owned oldest first, then shared in order granted. */
  websites: SwitcherWebsite[];
  current: SwitcherWebsite;
  /** Smaller, for the header, where it sits beside the workspace picker. */
  compact?: boolean;
  /** The switcher's wording, defaulting to English. */
  t?: Messages["app"]["dash"];
}) {
  const sharedHeadingId = useId();
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
      /*
        Navigate only if the selection was accepted. The list this menu
        renders can be stale — a website deleted in another tab is still an
        option here — and pushing to its URL anyway would land on a 404
        after the cookie had already refused it.
      */
      const result = await selectWebsite(id);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }

      const section = /^\/websites\/[^/]+(\/.*)?$/.exec(pathname);
      if (section) {
        router.push(`/websites/${id}${section[1] ?? ""}`);
      } else {
        // A query parameter, not a route: the dashboard is one page showing
        // one site at a time. websites[0] is the dashboard's own default (the
        // oldest owned site, else the first shared one - pickDashboardSite),
        // so the bare /dashboard shows the same site.
        router.push(id === websites[0]?.id ? "/dashboard" : `/dashboard?site=${id}`);
      }
      router.refresh();
    });
  }

  /*
    Split once, keeping the order each half arrived in. The server already
    sorts owned before shared; filtering rather than trusting that keeps a
    shared site out of the owned group even if a caller passes them mixed.
  */
  const owned = websites.filter((site) => site.access === "owner");
  const shared = websites.filter((site) => site.access !== "owner");

  /** "Editor" / "Viewer", for the chips. Never called for an owned site. */
  function roleLabel(access: WebsiteAccess): string {
    return access === "viewer" ? t.roleViewer : t.roleEditor;
  }

  function renderOption(site: SwitcherWebsite) {
    const selected = site.id === active.id;
    return (
      <button
        key={site.id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => choose(site.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
        )}
      >
        <Globe
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {site.brandName || site.domain}
        </span>
        {site.access !== "owner" ? (
          <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {roleLabel(site.access)}
          </span>
        ) : null}
        {selected ? (
          <Check className="size-4 shrink-0" aria-hidden="true" />
        ) : null}
      </button>
    );
  }

  /*
    On the trigger: the role, when the site on screen is shared.

    The header is the one place visible on every page, and the role is what
    explains why a delete button or the Billing tab is missing. The visible
    word is the role ("Editor") rather than "Shared": it is the answer to the
    question an invitee actually has - what may I do here - and it is short
    enough for the compact header. The full "Shared with you · Editor" is the
    chip's accessible name and tooltip - its own singular string, not the
    group heading with the role glued on: the heading is plural in French,
    Spanish and Italian, and this names one site.
  */
  const activeShared = active.access !== "owner";
  const activeSharedLabel = activeShared
    ? format(t.sharedSiteLabel, { role: roleLabel(active.access) })
    : null;

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
        {activeSharedLabel ? (
          <span
            title={activeSharedLabel}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
          >
            <Users className="size-3" aria-hidden="true" />
            <span aria-hidden="true">{roleLabel(active.access)}</span>
            <span className="sr-only">{activeSharedLabel}</span>
          </span>
        ) : null}
        <ChevronsUpDown
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </Button>

      {open ? (
        <div
            role="listbox"
            className="absolute left-0 z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
          >
            {owned.map(renderOption)}

            {/*
              The shared group, under its own heading. role="group" with the
              heading as its name, so a screen reader announces "Shared with
              you" on entering the group rather than reading the heading as an
              option nobody can pick. The divider only appears when there are
              owned sites above it to divide from.
            */}
            {shared.length > 0 ? (
              <div role="group" aria-labelledby={sharedHeadingId}>
                {owned.length > 0 ? (
                  <div className="my-1 h-px bg-border" role="presentation" />
                ) : null}
                <div
                  id={sharedHeadingId}
                  className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground"
                >
                  {t.sharedWithYou}
                </div>
                {shared.map(renderOption)}
              </div>
            ) : null}

            <div className="my-1 h-px bg-border" />

            <Link
              href="/websites/new"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/60"
            >
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              {t.addAWebsite}
            </Link>
        </div>
      ) : null}
    </div>
  );
}
