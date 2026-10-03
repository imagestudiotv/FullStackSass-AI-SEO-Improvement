"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/workspace/field";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { colourState } from "./settings-model";

/** Where the native picker opens when no valid colour is set yet. Never shown as a value. */
const PICKER_START = "#808080";

/**
 * The brand colour: ONE value drives the hex box, the swatch and its label.
 *
 * It used to show a black swatch beside a grey "#003388" placeholder when
 * nothing was stored - two different colours, neither of them real. Now:
 *  - empty: a crossed-out swatch and the words "No colour set";
 *  - a valid #rrggbb: the swatch in that colour;
 *  - anything else: a warning swatch, "Not a valid colour", and an inline
 *    error once the field has been left - and Save refuses it rather than
 *    reporting a value as saved that the server would silently drop.
 *
 * The swatch is also the picker: a native colour input lies over it, so
 * clicking (or Enter/Space when focused) opens the system picker.
 */
export function BrandColourField({
  value,
  onChange,
  onBlur,
  error,
  disabled,
  t,
  tWorkspace,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  t: Messages["app"]["article"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const state = colourState(value);

  return (
    <Field id="brand-colour" label={t.brandColour} hint={t.brandColourHint} error={error} optional t={tWorkspace}>
      {(props) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Input
            {...props}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            placeholder="#RRGGBB"
            autoComplete="off"
            spellCheck={false}
            className="w-32 font-mono"
          />

          <span
            className={cn(
              "relative inline-flex size-8 shrink-0 overflow-hidden rounded-lg border border-input focus-within:ring-3 focus-within:ring-ring/50",
              disabled ? "opacity-50" : "cursor-pointer",
            )}
          >
            {state.kind === "valid" ? (
              <span className="size-full" style={{ backgroundColor: state.hex }} aria-hidden="true" />
            ) : state.kind === "none" ? (
              // The usual "no colour" mark: white with a diagonal stroke.
              <span
                className="size-full bg-background bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),var(--color-muted-foreground)_calc(50%-1px),var(--color-muted-foreground)_calc(50%+1px),transparent_calc(50%+1px))]"
                aria-hidden="true"
              />
            ) : (
              <span className="flex size-full items-center justify-center bg-amber-50 text-amber-700" aria-hidden="true">
                <AlertTriangle className="size-4" />
              </span>
            )}
            <input
              type="color"
              aria-label={t.pickColour}
              value={state.kind === "valid" ? state.hex : PICKER_START}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
            />
          </span>

          <span
            className={cn(
              "text-sm",
              state.kind === "invalid" ? "font-medium text-amber-800" : "text-muted-foreground",
            )}
          >
            {state.kind === "none" ? t.noColour : state.kind === "invalid" ? t.invalidColour : state.hex}
          </span>

          {value !== "" && !disabled ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              {t.clearColour}
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  );
}
