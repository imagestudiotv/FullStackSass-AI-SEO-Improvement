"use client";

import { ArrowRight, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";

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
  label,
  placeholder,
  cta,
  pendingLabel,
  action,
}: {
  /** The field's accessible name (visually hidden). */
  label: string;
  placeholder: string;
  cta: string;
  /** The button's text while /audit loads. */
  pendingLabel: string;
  /** Locale-aware /audit path, so a Spanish reader stays in Spanish. */
  action: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pasted address routinely carries a trailing space.
    const domain = value.trim();
    if (!domain) {
      /*
        `required` already stops an empty field; this catches spaces only.
        Clear them, then let the browser say "please fill in this field" in
        the reader's language - rather than a button that silently does
        nothing.
      */
      flushSync(() => setValue(""));
      input.current?.reportValidity();
      return;
    }

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
        so it still reads as one control when the input has focus. On a phone
        the two stack inside a rounded card instead: a pill that tall would
        look like a lozenge.
      */
      className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-background p-2 ring-4 ring-primary/5 transition-shadow focus-within:ring-primary/15 sm:flex-row sm:items-center sm:gap-3 sm:rounded-full"
    >
      <label htmlFor="audit-quick" className="sr-only">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={input}
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
      {/*
        Solid from the start. It used to be disabled until something was
        typed, and the shared disabled style (half opacity) made the page's
        main button look faded and unclickable on arrival. Pressing it empty
        now gets the browser's "please fill in this field" instead; it is
        disabled only while /audit loads, so it cannot be pressed twice.
      */}
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full shrink-0 rounded-full px-7 text-base font-semibold sm:w-auto"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {pendingLabel}
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
