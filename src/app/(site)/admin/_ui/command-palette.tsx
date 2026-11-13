"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { ADMIN_NAV, type AdminNavItem } from "./nav";
import { useReturnFocus } from "./use-return-focus";
import { confirmLeave } from "./use-unsaved-changes";

/**
 * Ctrl/Cmd+K: jump to an admin PAGE.
 *
 * Navigation only - it searches the list of admin destinations, never
 * customer records, and says so. A cross-customer record search would need
 * its own authorised server query; this finds places, not people.
 */

/** Pure, for tests: the destinations whose label, keywords or description contain every typed word. */
export function filterDestinations(items: AdminNavItem[], query: string): AdminNavItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = [item.label, item.description, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const returnFocus = useReturnFocus();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        {...returnFocus}
      >
        {/* Remounted on each open, so the query and highlight start fresh. */}
        {open ? <PaletteBody onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const groups = useMemo(
    () =>
      ADMIN_NAV.map((group) => ({ label: group.label, items: filterDestinations(group.items, query) })).filter(
        (group) => group.items.length > 0,
      ),
    [query],
  );
  const flat = groups.flatMap((group) => group.items);
  const current = flat[Math.min(highlight, Math.max(flat.length - 1, 0))];

  function go(item: AdminNavItem | undefined) {
    if (!item) return;
    // router.push is not a link click, so the editors' link guard would not see it.
    if (item.href !== window.location.pathname && !confirmLeave()) return;
    onDone();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(current);
    }
  }

  return (
    <>
      <DialogTitle className="sr-only">Go to an admin page</DialogTitle>
      <DialogDescription className="sr-only">
        Type to filter admin pages, use the arrow keys to choose, Enter to open. This searches pages, not customer records.
      </DialogDescription>
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {/* Focused by the dialog on open (its first focusable element), after it has noted where focus was. */}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Go to page…"
          aria-label="Find an admin page"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${current.href}` : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border bg-muted px-1.5 text-[11px] text-muted-foreground">Esc</kbd>
      </div>
      <div id={listId} role="listbox" aria-label="Admin pages" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No admin page matches “{query}”.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label} className="mb-1 last:mb-0">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const selected = current?.href === item.href;
                return (
                  <div
                    key={item.href}
                    id={`${listId}-${item.href}`}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setHighlight(flat.indexOf(item))}
                    onClick={() => go(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                      selected ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    {selected ? <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">Finds admin pages only - not customer records.</p>
    </>
  );
}
