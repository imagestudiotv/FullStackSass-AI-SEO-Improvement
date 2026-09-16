"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Filters for an admin list.
 *
 * Written into the URL rather than component state, like the search box
 * beside it. An operator handling a support conversation needs to paste
 * "every failed payment for this customer" into a ticket, and a filtered view
 * that lives only in a component cannot be linked, bookmarked or survive a
 * refresh.
 *
 * Changing a filter always returns to page 1. Staying on page 7 while
 * narrowing 400 rows to 12 lands on an empty table, which reads as "no
 * results" rather than "you are past the end".
 */

export type FilterOption = { value: string; label: string };

export type FilterSpec = {
  /** URL parameter this control writes, e.g. "status". */
  param: string;
  label: string;
  /** The value meaning "no filter". Removed from the URL when chosen. */
  allValue: string;
  options: FilterOption[];
};

export function FilterBar({
  filters,
  /** Parameters to keep when a filter changes, e.g. the current search. */
  preserve = {},
  basePath,
}: {
  filters: FilterSpec[];
  preserve?: Record<string, string | undefined>;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(spec: FilterSpec, value: string) {
    const next = new URLSearchParams(params.toString());

    if (value === spec.allValue) next.delete(spec.param);
    else next.set(spec.param, value);

    // Narrowing the list invalidates the page number: see above.
    next.delete("page");

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  /**
   * Whether anything is actually filtering. Drives the "Clear" control, which
   * is hidden when there is nothing to clear rather than sitting there inert.
   */
  const active = filters.filter(
    (spec) => (params.get(spec.param) ?? spec.allValue) !== spec.allValue,
  );
  const searching = Object.entries(preserve).some(
    ([key, value]) => key === "q" && value,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.map((spec) => {
        const current = params.get(spec.param) ?? spec.allValue;
        return (
          <div key={spec.param} className="space-y-1.5">
            <Label
              htmlFor={`filter-${spec.param}`}
              className="text-xs text-muted-foreground"
            >
              {spec.label}
            </Label>
            <Select
              value={current}
              onValueChange={(value) => change(spec, value)}
            >
              <SelectTrigger
                id={`filter-${spec.param}`}
                size="sm"
                className="min-w-40"
              >
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
          </div>
        );
      })}

      {active.length > 0 || searching ? (
        <Button variant="ghost" size="sm" asChild>
          {/*
            A link to the bare path rather than a handler: it clears every
            parameter at once, including the search and the page, and an
            operator can see where it goes before clicking.
          */}
          <Link href={basePath}>
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
