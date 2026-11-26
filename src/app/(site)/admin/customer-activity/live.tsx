"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Admin -> Customer activity, live: the page is read again every 30 seconds
 * while the tab is visible (router.refresh(), the server component runs
 * again - no websocket, no polling API), at once when the tab comes back, and
 * not at all while paused. Rows that were not there before the refresh are
 * marked New.
 */

export const REFRESH_MS = 30_000;
/** A focus and a visibility change arrive together: one refresh for both. */
const DEDUPE_MS = 5_000;

/** The keys in `next` that `previous` did not have. */
export function freshKeys(previous: readonly string[], next: readonly string[]): Set<string> {
  const before = new Set(previous);
  return new Set(next.filter((key) => !before.has(key)));
}

const FreshKeys = createContext<ReadonlySet<string>>(new Set());

/**
 * Remembers the rows of the previous render. A new render (a refresh) with
 * the same filters marks what arrived; a change of filters marks nothing, or
 * every row of the new view would read as new.
 */
export function LiveFeed({
  keys,
  renderedAt,
  scope,
  children,
}: {
  keys: string[];
  renderedAt: number;
  /** The view's filters: rows are compared within one view only. */
  scope: string;
  children: ReactNode;
}) {
  const [seen, setSeen] = useState<{ renderedAt: number; scope: string; keys: string[]; fresh: ReadonlySet<string> }>(() => ({
    renderedAt,
    scope,
    keys,
    fresh: new Set(),
  }));
  // Adjusting state to new props during render, as React recommends instead of an effect.
  if (seen.renderedAt !== renderedAt || seen.scope !== scope) {
    setSeen({ renderedAt, scope, keys, fresh: seen.scope === scope ? freshKeys(seen.keys, keys) : new Set() });
  }
  return <FreshKeys.Provider value={seen.fresh}>{children}</FreshKeys.Provider>;
}

export function NewMark({ rowKey }: { rowKey: string }) {
  const fresh = useContext(FreshKeys);
  if (!fresh.has(rowKey)) return null;
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">
      New
    </span>
  );
}

const clock = (at: number) => `${new Date(at).toISOString().slice(11, 19)} UTC`;

export function AutoRefresh({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    if (paused) return;
    const refresh = (force: boolean) => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (!force && now - last.current < DEDUPE_MS) return;
      last.current = now;
      router.refresh();
    };
    const timer = window.setInterval(() => refresh(true), REFRESH_MS);
    const onReturn = () => refresh(false);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [paused, router]);

  return (
    <div className="flex items-center gap-2">
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {paused ? "Paused · " : ""}Updated <time dateTime={new Date(renderedAt).toISOString()}>{clock(renderedAt)}</time>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 bg-background"
        aria-pressed={paused}
        title={paused ? "Refresh every 30 seconds again" : "Stop refreshing every 30 seconds"}
        onClick={() => {
          if (paused) {
            last.current = Date.now();
            router.refresh();
          }
          setPaused(!paused);
        }}
      >
        {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
        {paused ? "Resume" : "Pause"}
      </Button>
    </div>
  );
}
