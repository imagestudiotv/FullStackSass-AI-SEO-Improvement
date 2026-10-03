"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/** What a control needs to be wired to its label, hint and error. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

/**
 * A labelled form control with its hint, a character count near a limit,
 * and its error - each wired to the control (htmlFor, aria-describedby,
 * aria-invalid), so a screen reader hears the hint and the error with the
 * field, not as loose text.
 *
 * The control comes in as a render function so the wiring cannot be
 * forgotten:
 *
 *   <Field id="brand" label="Brand name" hint="…" error={errors.brand} t={t}>
 *     {(props) => <Input {...props} value={…} onChange={…} />}
 *   </Field>
 *
 * The count appears only from 80% of the limit (and in red over it): a
 * counter on every field is noise, but discovering the limit only when the
 * server truncates a description is worse.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  required,
  count,
  labelAction,
  t,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  required?: boolean;
  /** Current length and limit, for a counter near the limit. */
  count?: { value: number; max: number };
  /** Something small beside the label, e.g. a "Suggested" tag. */
  labelAction?: ReactNode;
  t: Messages["app"]["workspace"];
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const countId = count ? `${id}-count` : undefined;
  const near = count ? count.value >= count.max * 0.8 : false;
  const over = count ? count.value > count.max : false;
  const describedBy = [errorId, hintId, near ? countId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {optional ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.optional}</span> : null}
          {required ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {labelAction}
      </div>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error || over ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint || near ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {hint ? (
            <p id={hintId} className="text-xs leading-5 text-muted-foreground">
              {hint}
            </p>
          ) : (
            <span />
          )}
          {count && near ? (
            <p
              id={countId}
              className={cn("shrink-0 text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}
              aria-live="polite"
            >
              {over
                ? plural(t.overLimit, count.value - count.max)
                : plural(t.charactersLeft, count.max - count.value)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
