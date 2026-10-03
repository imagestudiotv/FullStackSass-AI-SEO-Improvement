"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Site = { id: string; domain: string; role: string; viaWorkspace: boolean };

const VISIBLE = 3;

/**
 * What a person can work on, and how they got there. The two routes are
 * drawn differently on purpose: workspace access (solid) covers every site
 * the workspace owns and cannot be withdrawn per site, while an invitation
 * (dashed) covers exactly one. An operator asked "why can they see that?"
 * needs to tell them apart.
 *
 * Each chip opens Websites searched for that domain. Beyond three, a "+N"
 * button shows the rest in place - a count rather than a fourth chip keeps
 * one person with twelve sites from making their row taller than the table,
 * and a button (not a hover title) lets a keyboard or touch user see them.
 */
export function WebsiteChips({ sites }: { sites: Site[] }) {
  const [expanded, setExpanded] = useState(false);
  if (sites.length === 0) return <span className="text-sm text-muted-foreground">None</span>;

  const shown = expanded ? sites : sites.slice(0, VISIBLE);
  const hidden = sites.length - shown.length;

  return (
    <ul className="flex max-w-md flex-wrap gap-1" aria-label="Websites">
      {shown.map((site) => {
        const how = site.viaWorkspace ? "through the workspace" : `invited as ${site.role}`;
        return (
          <li key={site.id} className="min-w-0">
            <Link
              href={`/admin/websites?q=${encodeURIComponent(site.domain)}`}
              title={`${site.domain} - ${how}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                site.viaWorkspace ? "bg-background" : "border-dashed text-muted-foreground",
              )}
            >
              {/* Whole, wrapping if it must: a truncated domain was only readable on hover. */}
              <span className="min-w-0 [overflow-wrap:anywhere]">{site.domain}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70" aria-hidden="true">
                {site.role}
              </span>
              <span className="sr-only">, {how}</span>
            </Link>
          </li>
        );
      })}
      {sites.length > VISIBLE ? (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs tabular-nums text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            {expanded ? "Show fewer" : `+${hidden} more`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
