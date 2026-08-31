"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Domain input for the free audit.
 *
 * The domain lives in the URL rather than component state, so a result can be
 * shared or bookmarked — which matters for a lead magnet people pass around.
 *
 * A crawl takes several seconds. Without a visible pending state the page
 * looks frozen and visitors click again, so the button reports progress and
 * the input locks while it runs.
 */
export function AuditForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * `key` on this component is the domain from the URL, so navigating to a
   * new result remounts the form and re-seeds the field. That replaces an
   * effect that synced state to the URL — setState inside an effect causes a
   * cascading re-render, and React rightly flags it.
   */
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Trimmed: a pasted address routinely carries a trailing space, which
    // would otherwise be sent as part of the domain.
    const domain = value.trim();
    if (!domain) return;
    startTransition(() => {
      router.push(`/audit?domain=${encodeURIComponent(domain)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="audit-domain" className="sr-only">
        Your website address
      </label>
      <Input
        id="audit-domain"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="yourwebsite.com"
        autoComplete="url"
        disabled={pending}
        className="h-11 flex-1"
        required
      />
      <Button type="submit" size="lg" disabled={pending || !value.trim()}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Checking your site…
          </>
        ) : (
          <>
            <Search className="size-4" />
            Check my website
          </>
        )}
      </Button>
    </form>
  );
}
