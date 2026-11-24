"use client";

import { CreditCard } from "lucide-react";
import { useId } from "react";

import { PayPalMark } from "@/components/paypal-mark";
import type { PaymentChoiceCopy } from "@/lib/i18n/buy-credits";

export type PaymentMethod = "card" | "paypal";

/**
 * Card or PayPal, before going to the provider's own page. Only the methods
 * the server can really start are passed in; with one there is still a row,
 * so the customer reads how they will pay. Native radios: arrow keys and
 * screen readers work as everywhere else.
 */
export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  copy,
  disabled = false,
}: {
  methods: PaymentMethod[];
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  copy: PaymentChoiceCopy;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-foreground">{copy.label}</legend>
      {methods.map((method) => (
        <label
          key={method}
          className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/40 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-default has-disabled:opacity-60"
        >
          <input
            type="radio"
            name={name}
            value={method}
            checked={value === method}
            onChange={() => onChange(method)}
            className="size-4 shrink-0 accent-primary outline-none"
          />
          {method === "card" ? (
            <CreditCard className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <PayPalMark className="size-5 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{method === "card" ? copy.card : "PayPal"}</span>
            <span className="block text-xs text-muted-foreground">{method === "card" ? copy.cardHelp : copy.paypalHelp}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
