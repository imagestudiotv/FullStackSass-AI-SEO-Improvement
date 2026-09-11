"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";

/**
 * Error boundary for every signed-in route.
 *
 * Without one, a thrown server error rendered Next's default screen: a bare
 * "Application error" on an unstyled page, outside the app shell, with no way
 * back. The customer's own conclusion is that the product is broken.
 *
 * `notFound()` is NOT handled here — Next routes that to not-found.tsx — so
 * the 404 that requireWebsite() raises for another tenant's website id keeps
 * its existing meaning. Nothing in this file weakens that boundary.
 */

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /**
     * Sentry already captures this through its Next.js integration; this is
     * the browser-console copy a developer sees while working. The customer
     * never sees the message itself — see below.
     */
    console.error("[app] route error", error);
  }, [error]);

  return (
    <PageShell>
      <ErrorState
        title="Something went wrong on this page"
        /**
         * Deliberately not error.message. That string is written for a log and
         * routinely contains a provider's raw response, a query fragment or an
         * internal id — none of which a small-business owner can act on, and
         * some of which should not be on their screen at all.
         *
         * The digest is included because it is the one thing that makes a
         * support conversation solvable: it ties this screen to the captured
         * exception without exposing anything about it.
         */
        message={
          error.digest
            ? `The page could not be loaded. Trying again usually works. If it keeps happening, quote reference ${error.digest} to support.`
            : "The page could not be loaded. Trying again usually works. If it keeps happening, contact support."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} size="sm">
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
