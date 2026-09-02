"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Domain input for the robots.txt checker.
 *
 * The domain lives in the URL so a result can be shared or bookmarked. `key`
 * on this component is that domain, so navigating to a new result remounts the
 * form and re-seeds the field — rather than syncing state in an effect, which
 * causes a cascading render.
 */
export function RobotsForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space, which would
    // otherwise be sent as part of the domain.
    const domain = value.trim();
    if (!domain) return;
    startTransition(() => {
      router.push(`/tools/robots-checker?domain=${encodeURIComponent(domain)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="robots-domain" className="sr-only">
        Your website address
      </label>
      <Input
        id="robots-domain"
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
            Checking…
          </>
        ) : (
          <>
            <Search className="size-4" />
            Check robots.txt
          </>
        )}
      </Button>
    </form>
  );
}
