"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * One toolbar for an admin list: search, filters, the active filters as
 * removable chips, "Clear all", and the result count.
 *
 * THE URL IS THE STATE. Search and filters are written into the query string,
 * so a filtered view can be shared, survives a refresh, and the back button
 * restores it - including the controls, which read the URL rather than
 * keeping their own copy. Every change returns to page 1: narrowing 400 rows
 * to 12 while staying on page 7 shows an empty table that reads as "no
 * results". (The old search box kept the page, and kept showing a stale
 * query after back/forward.)
 */

export type ToolbarFilterOption = { value: string; label: string };

export type ToolbarFilter = {
  /** URL parameter this control writes, e.g. "status". */
  param: string;
  label: string;
  /** The value meaning "no filter"; removed from the URL when chosen. */
  allValue: string;
  options: ToolbarFilterOption[];
};

/** The pure URL step, exported for tests: apply changes and always drop the page. */
export function nextListQuery(
  current: string,
  changes: Record<string, string | null>,
  pageParam = "page",
): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  next.delete(pageParam);
  return next.toString();
}

export function AdminToolbar({
  searchParam = "q",
  searchPlaceholder,
  searchLabel = "Search",
  filters = [],
  /** Parameters that belong to the view, not the filter (e.g. a tab); kept by "Clear all". */
  keep = [],
  resultLabel,
  className,
  children,
}: {
  searchParam?: string;
  /** Omit to render no search box. */
  searchPlaceholder?: string;
  searchLabel?: string;
  filters?: ToolbarFilter[];
  keep?: string[];
  /** e.g. "1,204 organizations" or "12 matching". Server-computed, so always the real total. */
  resultLabel?: string;
  className?: string;
  /** Extra controls on the right (exports, view toggles). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get(searchParam) ?? "";

  function go(changes: Record<string, string | null>) {
    const qs = nextListQuery(params.toString(), changes);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const active = filters
    .map((spec) => ({ spec, value: params.get(spec.param) }))
    .filter((entry): entry is { spec: ToolbarFilter; value: string } => Boolean(entry.value) && entry.value !== entry.spec.allValue);

  const clearAll = (() => {
    const kept = new URLSearchParams();
    for (const key of keep) {
      const value = params.get(key);
      if (value) kept.set(key, value);
    }
    const qs = kept.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const chipHref = (changes: Record<string, string | null>) => {
    const qs = nextListQuery(params.toString(), changes);
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {searchPlaceholder ? (
          // Keyed by the URL value: back/forward or a chip removal remounts it with the right text.
          <SearchBox
            key={query}
            initial={query}
            placeholder={searchPlaceholder}
            label={searchLabel}
            onSubmit={(value) => go({ [searchParam]: value.trim() || null })}
          />
        ) : null}
        {filters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((spec) => {
              // An empty value (?status=) is no filter on the server, so show it as "all" rather than blank.
              const current = params.get(spec.param) || spec.allValue;
              // A control whose only option is the default is not a choice - unless it is the active filter.
              if (spec.options.length < 2 && current === spec.allValue) return null;
              return (
                <Select key={spec.param} value={current} onValueChange={(value) => go({ [spec.param]: value === spec.allValue ? null : value })}>
                  <SelectTrigger size="sm" aria-label={spec.label} className="h-9 min-w-36 bg-background">
                    <span className="text-muted-foreground">{spec.label}:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {spec.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
        ) : null}
        {children ? <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{children}</div> : null}
      </div>

      {active.length > 0 || query || resultLabel ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {resultLabel ? (
            <p className="mr-1 tabular-nums text-muted-foreground" aria-live="polite">
              {resultLabel}
            </p>
          ) : null}
          {query ? (
            <Chip href={chipHref({ [searchParam]: null })} label={`${searchLabel}: “${query}”`} />
          ) : null}
          {active.map(({ spec, value }) => (
            <Chip
              key={spec.param}
              href={chipHref({ [spec.param]: null })}
              label={`${spec.label}: ${spec.options.find((option) => option.value === value)?.label ?? value}`}
            />
          ))}
          {active.length + (query ? 1 : 0) > 1 ? (
            <Button variant="ghost" size="sm" asChild className="h-7 text-muted-foreground">
              <Link href={clearAll}>Clear all</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchBox({
  initial,
  placeholder,
  label,
  onSubmit,
}: {
  initial: string;
  placeholder: string;
  label: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      className="relative flex w-full min-w-0 gap-2 lg:max-w-md"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 bg-background pl-9"
      />
      <Button type="submit" variant="outline" className="h-9 shrink-0 bg-background">
        Search
      </Button>
    </form>
  );
}

function Chip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background py-0.5 pl-2.5 pr-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Remove filter ${label}`}
    >
      <span className="truncate">{label}</span>
      <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
