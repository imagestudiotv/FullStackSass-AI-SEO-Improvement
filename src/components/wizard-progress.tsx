import { Check } from "lucide-react";
import Link from "next/link";

import { WIZARD_STEPS, wizardStepIndex, type WizardStepId } from "@/lib/onboarding/wizard";

/**
 * The step indicator across the top of setup, as the reference has it.
 *
 * Completed steps link back so someone can correct an earlier answer; steps
 * ahead are inert. Making a future step clickable would let someone skip into
 * a screen whose data does not exist yet, which is how a wizard ends up
 * showing an empty form with no explanation.
 */
export function WizardProgress({ current }: { current: WizardStepId }) {
  const currentIndex = wizardStepIndex(current);

  return (
    /*
      No border and no card fill: the reference runs the steps straight over
      the page, directly under the header, as part of the same top area. The
      bordered strip this had made a second header bar and pushed the content
      down by its full height.

      Narrower too — max-w-2xl against the previous 3xl — so five dots read as
      a compact indicator rather than a full-width rule across the screen.
    */
    <nav aria-label="Setup progress" className="bg-background">
      <ol className="mx-auto flex max-w-2xl items-start gap-1 px-4 pt-1 pb-6 sm:gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;

          const dot = (
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/25 bg-card text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
          );

          return (
            <li key={step.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {/* Connector before the dot, except on the first step. */}
                <span
                  className={`h-0.5 flex-1 ${
                    index === 0
                      ? "invisible"
                      : done || active
                        ? "bg-emerald-500"
                        : "bg-border"
                  }`}
                  aria-hidden="true"
                />
                {done ? (
                  <Link href={step.href} aria-label={`Back to ${step.label}`}>
                    {dot}
                  </Link>
                ) : (
                  dot
                )}
                <span
                  className={`h-0.5 flex-1 ${
                    index === WIZARD_STEPS.length - 1
                      ? "invisible"
                      : done
                        ? "bg-emerald-500"
                        : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              </div>

              <span
                className={`text-center text-[11px] leading-tight ${
                  active
                    ? "font-semibold text-foreground"
                    : done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
