"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Domain input shared by every tool that takes one.
 *
 * The domain lives in the URL so a result can be shared or bookmarked. `key` on
 * this component should be that domain, so navigating to a new result remounts
 * the form and re-seeds the field — rather than syncing state in an effect,
 * which causes a cascading render.
 *
 * These checks take several seconds. Without a visible pending state the page
 * looks frozen and people click again, so the button reports progress and the
 * input locks while it runs.
 */
export function DomainToolForm({
  action,
  defaultValue,
  submitLabel,
  pendingLabel = "Checking…",
  placeholder = "yourwebsite.com",
  label = "Your website address",
}: {
  /** Path this tool lives at, e.g. "/tools/sitemap-checker". */
  action: string;
  defaultValue: string;
  submitLabel: string;
  pendingLabel?: string;
  placeholder?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  const inputId = `domain-${action.replace(/\W+/g, "-")}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space, which would
    // otherwise be sent as part of the domain.
    const domain = value.trim();
    if (!domain) return;
    startTransition(() => {
      router.push(`${action}?domain=${encodeURIComponent(domain)}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium"
        >
          {label}
        </label>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="url"
          disabled={pending}
          className="h-11"
          required
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-11 rounded-full px-6"
        disabled={pending || !value.trim()}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          <>
            <Search className="size-4" />
            {submitLabel}
          </>
        )}
      </Button>
    </form>
  );
}
