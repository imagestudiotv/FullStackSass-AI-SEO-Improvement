"use client";

import { Check, ChevronsUpDown, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
}: {
  websites: { id: string; domain: string; brandName: string | null }[];
  current: { id: string; domain: string; brandName: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function choose(id: string) {
    setOpen(false);
    // A query parameter, not a route: the dashboard is one page showing one
    // site at a time, and a per-site path would duplicate every panel's route.
    router.push(id === websites[0]?.id ? "/dashboard" : `/dashboard?site=${id}`);
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-11 gap-2 rounded-full pl-3 pr-2 text-base font-medium"
      >
        <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="max-w-[16rem] truncate">
          {current.brandName || current.domain}
        </span>
        <ChevronsUpDown
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </Button>

      {open ? (
        <>
          {/*
            A full-screen button behind the menu closes it on any outside
            click. Cheaper than a document listener, and it keeps the dismissal
            reachable from the keyboard.
          */}
          <button
            type="button"
            aria-label="Close website menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-popover p-1 shadow-md"
          >
            {websites.map((site) => (
              <button
                key={site.id}
                type="button"
                role="option"
                aria-selected={site.id === current.id}
                onClick={() => choose(site.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  site.id === current.id
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
                {site.id === current.id ? (
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
        </>
      ) : null}
    </div>
  );
}
