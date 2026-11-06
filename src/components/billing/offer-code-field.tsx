"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import type { OfferCodeCopy } from "@/lib/i18n/offer-code";

/** The REPGET code, given to RepGet before Checkout (lib/billing/repget-offer.ts). */
export function OfferCodeField({
  copy,
  value,
  onChange,
  className,
}: {
  copy: OfferCodeCopy;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {copy.label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={24}
        aria-describedby={`${id}-help`}
        className="mt-1.5"
      />
      <p id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {copy.help}
      </p>
    </div>
  );
}
