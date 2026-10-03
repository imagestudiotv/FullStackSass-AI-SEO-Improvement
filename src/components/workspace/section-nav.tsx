"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type SectionNavItem = { id: string; label: string; icon?: LucideIcon; badge?: string };

/**
 * Navigation between the sections of one long page.
 *
 * Plain anchor links to section ids - every section stays in the page and in
 * the document order, nothing is hidden behind a tab - with the section on
 * screen marked (aria-current="location"). On wide screens it is a sticky
 * rail beside the content ("rail"); on narrower ones the same links as a
 * horizontally scrolling row above it ("bar").
 *
 * Route-based navigation between pages stays where it is (SettingsNav); this
 * only moves within a page.
 */
export function SectionNav({
  items,
  label,
  variant,
  className,
}: {
  items: SectionNavItem[];
  /** Accessible name, e.g. "On this page". */
  label: string;
  variant: "rail" | "bar";
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const targets = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    // The section whose top has most recently passed under the header band.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  if (variant === "bar") {
    return (
      <nav aria-label={label} className={cn("-mx-1 overflow-x-auto", className)}>
        <ul className="flex min-w-max gap-1 px-1 pb-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active === item.id ? "location" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  active === item.id ? "border-primary/30 bg-primary/10 font-medium text-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.badge ? <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{item.badge}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={label} className={cn("sticky top-20", className)}>
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const current = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  current ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {current ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                {Icon ? <Icon className={cn("size-4 shrink-0", current ? "text-primary" : "")} aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.badge ? <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{item.badge}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
