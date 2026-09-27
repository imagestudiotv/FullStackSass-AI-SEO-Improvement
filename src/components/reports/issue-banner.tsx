"use client";

import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * A verification-issue banner.
 *
 * Dismissing it hides THIS set of issues for this viewer only: the choice is
 * kept in the browser under the issue fingerprint, which changes whenever an
 * issue is added, so a new problem shows the banner again. Nothing about the
 * links, their verification or their credits changes - the issues stay
 * listed on the filtered page the button opens.
 */

const PREFIX = "repget:issue-dismissed:";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function IssueBanner({
  storageKey,
  title,
  help,
  href,
  actionLabel,
  dismissLabel,
}: {
  /** Website id + fingerprint of the issue set. */
  storageKey: string;
  title: string;
  help: string;
  href: string;
  actionLabel: string;
  dismissLabel: string;
}) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    // Server render and first paint: shown. Dismissal is a browser preference.
    () => false,
  );
  if (dismissed) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-90">{help}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
          <Link href={href}>{actionLabel}</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={dismissLabel}
          onClick={() => {
            try {
              window.localStorage.setItem(PREFIX + storageKey, "1");
            } catch {
              // Storage unavailable (private mode): the banner simply stays.
            }
            listeners.forEach((listener) => listener());
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
