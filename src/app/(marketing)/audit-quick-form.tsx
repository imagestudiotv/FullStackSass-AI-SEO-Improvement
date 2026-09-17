"use client";

import { ArrowRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * The domain field on the homepage audit card.
 *
 * Carries the address to /audit and stops there. It deliberately does NOT run
 * an audit itself: that page owns the URL validation, the SSRF guard, the
 * caching and the error states, and a second entry point doing its own
 * crawling would be a second copy of all of it — which is exactly the kind of
 * pair that drifts apart.
 *
 * The pending state matters even though this only navigates. /audit is a
 * server component that crawls before it renders, so the click is followed by
 * a real wait; without a spinner here the button looks ignored and people
 * press it again.
 */
export function AuditQuickForm({
  placeholder,
  cta,
  action,
}: {
  placeholder: string;
  cta: string;
  /** Locale-aware /audit path, so a Spanish reader stays in Spanish. */
  action: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space.
    const domain = value.trim();
    if (!domain) return;

    startTransition(() => {
      router.push(`${action}?domain=${encodeURIComponent(domain)}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      /*
        One pill containing both controls, as the design draws it, rather than
        a field beside a button. focus-within moves the ring to the whole pill
        so it still reads as one control when the input has focus.
      */
      className="flex flex-col gap-3 rounded-full border border-primary/30 bg-background p-2 ring-4 ring-primary/5 transition-shadow focus-within:ring-primary/15 sm:flex-row sm:items-center"
    >
      <label htmlFor="audit-quick" className="sr-only">
        Your website address
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="audit-quick"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoComplete="url"
          inputMode="url"
          disabled={pending}
          required
          /*
            A bare input rather than the shared Input component: that one
            carries its own border and rounding, which would draw a second
            outline inside the pill.
          */
          className="h-12 w-full bg-transparent pr-4 pl-11 text-base outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
      </div>
      <Button
        type="submit"
        disabled={pending || !value.trim()}
        className="h-12 shrink-0 rounded-full px-7 text-base font-semibold"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Checking…
          </>
        ) : (
          <>
            {cta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}
