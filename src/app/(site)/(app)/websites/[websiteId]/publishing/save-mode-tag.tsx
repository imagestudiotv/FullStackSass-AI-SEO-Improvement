import { Save, Zap } from "lucide-react";
import type { ReactNode } from "react";

import type { Messages } from "@/lib/i18n/messages";

/**
 * Says, on every section, HOW its settings are kept: with the Save button at
 * the bottom, or the moment they change. The page mixes both (Writing and
 * publishing saves immediately, as it always has), so each section names its
 * own rule in words and an icon rather than leaving people to guess.
 *
 * It wraps onto a second line rather than pushing anything aside: the German
 * and French wording is twice the English length.
 */
export function SaveModeTag({ mode, t }: { mode: "button" | "immediate"; t: Messages["app"]["workspace"] }) {
  const Icon = mode === "button" ? Save : Zap;
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs leading-5 text-muted-foreground">
      <Icon className="mt-0.75 size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{mode === "button" ? t.savedWithButton : t.savesImmediately}</span>
    </span>
  );
}

/**
 * A section's description: its help line, then (for people who can edit) how
 * it is saved. Kept under the description rather than in the header's action
 * slot, which does not shrink, so a long translation never squeezes the
 * section title into a narrow column.
 */
export function SectionIntro({ help, children }: { help: ReactNode; children?: ReactNode }) {
  return (
    <>
      <p>{help}</p>
      {children ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">{children}</div> : null}
    </>
  );
}
