"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The parts every customer-admin dialog shares (workspace, website, account
 * and bulk deletions, credits, suspension), so the reason, the typed
 * confirmation and a server refusal look and read the same everywhere.
 *
 * The rules below MIRROR the server's (src/lib/admin/operations.ts) so a
 * disabled button can say why. The server still decides.
 */

export const CONFIRM_WORD = "DELETE";

/** A written reason of at least three characters, as the server requires. */
export function reasonOk(reason: string): boolean {
  return reason.trim().length >= 3;
}

export function ReasonField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const tooShort = value.length > 0 && !reasonOk(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Why?</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={cn("text-xs", tooShort ? "text-foreground" : "text-muted-foreground")}>
        {tooShort ? "Write at least 3 characters." : "Recorded against your name in the admin log."}
      </p>
    </div>
  );
}

/** "Type DELETE to confirm" - exact and case-sensitive, like the server. */
export function ConfirmField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={CONFIRM_WORD}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        disabled={disabled}
        className="font-mono"
      />
    </div>
  );
}

/** What happens and what does not - read before the operator types anything. */
export function DialogNotes({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-1 rounded-lg border bg-muted/40 py-2.5 pl-7 pr-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </ul>
  );
}

/**
 * The server's refusal, kept in the dialog as well as the toast: deletion
 * refusals (a subscription still billing, an open checkout, your own account)
 * are long and specific, and a toast is gone before it has been read.
 */
export function DialogError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 wrap-anywhere">{message}</p>
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}
