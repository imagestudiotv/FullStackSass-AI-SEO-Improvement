"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useKeyboardOpen } from "@/components/workspace/save-bar";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * "Happy with these? Keep the defaults" - for a customer who has never saved
 * these settings and changes nothing.
 *
 * Keeping every default is a decision and needs a button: it records the
 * review (articleSettingsReviewedAt) that closes the launch checklist's
 * "preferences" step. It sits in the save bar's slot, with the save bar's
 * geometry (clear of the sidebar, under dialogs, out of the chat launcher's
 * corner, hidden while a phone keyboard is open), and the two never show at
 * once: this one needs no changes, the save bar needs one.
 */
export function ConfirmDefaultsBar({
  saving,
  failure,
  onConfirm,
  tCommon,
  tWorkspace,
}: {
  saving: boolean;
  failure: string | null;
  onConfirm: () => void;
  tCommon: Messages["app"]["common"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const keyboardOpen = useKeyboardOpen();
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t-2 border-t-primary bg-background/95 pr-24 backdrop-blur transition-transform supports-[backdrop-filter]:bg-background/85 motion-reduce:transition-none md:left-60",
        keyboardOpen && "pointer-events-none translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 py-3 pl-4 md:pl-8">
        {/*
          On a phone the words take their own row and the button goes under
          them: side by side, a long translation of the button ("Mantieni le
          impostazioni predefinite") left the text a column a few letters wide.
        */}
        <div className="min-w-0 flex-1 text-sm max-sm:basis-full" role="status" aria-live="polite">
          {saving ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {tWorkspace.saving}
            </span>
          ) : failure ? (
            <span className="flex items-start gap-2 text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">{format(tWorkspace.saveFailed, { error: failure })}</span>
            </span>
          ) : (
            <span className="font-medium text-foreground">{tCommon.defaultsAreFine}</span>
          )}
        </div>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          // May wrap on a phone rather than run under the chat launcher.
          className="shrink-0 max-sm:h-auto max-sm:min-h-8 max-sm:max-w-full max-sm:py-1.5 max-sm:text-left max-sm:whitespace-normal"
        >
          {saving ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {tCommon.keepDefaults}
        </Button>
      </div>
    </div>
  );
}
