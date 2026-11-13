"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * An admin page that failed to render. Inside the admin shell, so the
 * navigation stays usable, with a retry. There was no boundary here before:
 * a database hiccup on any admin page replaced the whole document with the
 * global error screen.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border bg-card px-6 py-14 text-center" role="alert">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">This page could not be loaded</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Something failed while reading the data. Nothing was changed. Try again; if it keeps failing, check the server logs
        {error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>
          <RotateCw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Go to overview</Link>
        </Button>
      </div>
    </div>
  );
}
