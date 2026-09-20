"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Globe,
  Link2,
  Rocket,
  ScanSearch,
  Settings2,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LaunchStep, LaunchStepIcon } from "@/lib/onboarding/launch";

/**
 * The launch checklist rows, following the client's screenshot.
 *
 * Each row carries its own icon, a status pill on the right, and a chevron
 * that expands it. A connector line runs down the left through the markers.
 *
 * A client component because rows expand — that is local state, and making the
 * whole page client-side to get it would pull the database queries into the
 * bundle. The page stays a server component and hands the rows down.
 */

/**
 * Icon names to components.
 *
 * The step data crosses from a server component, where a React component is
 * not serialisable, so the name travels and the mapping happens here.
 */
const ICONS: Record<LaunchStepIcon, typeof Globe> = {
  site: Globe,
  google: BarChart3,
  audit: ScanSearch,
  article: FileText,
  link: Link2,
  settings: Settings2,
  eye: Eye,
  rocket: Rocket,
};

export function SetupSteps({ steps }: { steps: LaunchStep[] }) {
  /**
   * Which row is open.
   *
   * The design ships with the final row expanded once everything is live,
   * because that row is the payoff — it explains what is now running. One at
   * a time: this is a checklist to scan, not a document to read.
   */
  const [openId, setOpenId] = useState<string | null>(() => {
    const last = steps[steps.length - 1];
    return last?.done && last.detail ? last.id : null;
  });

  return (
    <ol className="mt-5">
      {steps.map((step, index) => {
        const Icon = ICONS[step.icon];
        const last = index === steps.length - 1;
        const open = openId === step.id;
        /**
         * An optional step nobody has done reads as "Skipped" rather than
         * "To do", as the design has it: it is not outstanding work, it is a
         * choice already made by not making it.
         */
        const skipped = step.optional && !step.done;

        return (
          <li key={step.id} className="flex gap-3">
            {/* Marker column, with the connector running through it. */}
            <div className="flex shrink-0 flex-col items-center">
              <span
                className={`flex size-8 items-center justify-center rounded-full ${
                  step.done
                    ? "bg-emerald-500 text-white"
                    : skipped
                      ? "border border-muted-foreground/30 bg-card text-muted-foreground"
                      : "border-2 border-muted bg-card text-muted-foreground"
                }`}
              >
                {step.done ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : skipped ? (
                  <SkipForward className="size-3.5" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-semibold">{index + 1}</span>
                )}
              </span>
              {last ? null : (
                <span
                  className={`w-px flex-1 border-l border-dashed ${
                    step.done
                      ? "border-emerald-500/40"
                      : "border-muted-foreground/25"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>

            <div
              className={`mb-2 min-w-0 flex-1 rounded-xl border ${
                step.done
                  ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                  : "bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Icon
                  className={`size-4 shrink-0 ${
                    step.done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                  aria-hidden="true"
                />

                {/*
                  The title links to where the work happens. The row's chevron
                  is a separate control beside it, so opening the detail and
                  going to the page are not the same click.
                */}
                <Link
                  href={step.href}
                  className="min-w-0 flex-1 text-sm font-medium hover:underline"
                >
                  {step.title}
                </Link>

                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    step.done
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : skipped
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {step.done ? (
                    <>
                      <Check className="size-3" aria-hidden="true" />
                      Done
                    </>
                  ) : skipped ? (
                    <>
                      <SkipForward className="size-3" aria-hidden="true" />
                      Skipped
                    </>
                  ) : (
                    "To do"
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : step.id)}
                  aria-expanded={open}
                  aria-label={
                    open ? `Hide ${step.title}` : `Show ${step.title}`
                  }
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown
                    className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {open ? (
                <div className="border-t px-4 py-3.5">
                  <p className="text-sm text-muted-foreground">
                    {step.detail ?? step.description}
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant={step.done ? "default" : "outline"}
                    className="mt-3 rounded-full"
                  >
                    <Link href={step.href}>
                      {step.done ? "Go to dashboard" : `Open ${step.title}`}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
