"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A long value (domain, URL, email, title) that fits one line until asked.
 *
 * Truncated with an ellipsis; a click or Enter/Space shows it in full,
 * wrapped. Not hover-only: a keyboard or touch user reaches the full value
 * the same way. Plain text when it is short enough not to need it.
 */
export function ExpandableText({
  text,
  className,
  mono = false,
  threshold = 32,
}: {
  text: string;
  className?: string;
  mono?: boolean;
  /** Below this many characters it is shown as plain text. */
  threshold?: number;
}) {
  const [open, setOpen] = useState(false);
  if (text.length <= threshold) {
    return <span className={cn("[overflow-wrap:anywhere]", mono && "font-mono text-[13px]", className)}>{text}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      title={open ? undefined : text}
      className={cn(
        // relative: the sr-only hint is absolutely positioned; without a containing block here it escaped the
        // clipped button and widened the page on a phone.
        "relative block max-w-full whitespace-normal rounded-sm text-left outline-none [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-ring",
        mono && "font-mono text-[13px]",
        className,
      )}
    >
      {/*
        Collapsed is one clamped line, not `truncate`: nowrap text cannot get
        narrower than itself, so in a table a "truncated" domain still forced
        its full width on the column. Wrapping text clamped to a line looks the
        same and lets the column give way.
      */}
      <span className={open ? undefined : "line-clamp-1"}>{text}</span>
      <span className="sr-only">{open ? " (collapse)" : " (show in full)"}</span>
    </button>
  );
}
