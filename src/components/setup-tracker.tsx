"use client";

import { Check, ChevronDown, Lock, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import type { LaunchStep } from "@/lib/onboarding/launch";

/**
 * The floating "Set up · Step 3 of 7" panel, above the chat launcher.
 *
 * The client asked for it: "near the chat all pending steps missing design.
 * This will be really awesome and intuitive… it will still continue to appear
 * thoose setup steps is missing to complete the integration and activation."
 *
 * So it follows the customer around the dashboard rather than living on one
 * page — the point is that setup stays visible WHILE they explore, instead of
 * being a screen they have to go back to.
 *
 * It disappears on its own once the required steps are done. Nothing to
 * dismiss permanently, because there is nothing left to nag about.
 */

/** Remembers a dismissal for this browser, so it is not nagging every page. */
const STORAGE_KEY = "repget:setup-tracker-dismissed";

export function SetupTracker({ steps }: { steps: LaunchStep[] }) {
  const [collapsed, setCollapsed] = useState(false);
  /** Set by the dismiss button, separate from what storage remembers. */
  const [dismissedNow, setDismissedNow] = useState(false);

  /**
   * Whether this browser hid the panel before, read through
   * useSyncExternalStore rather than an effect.
   *
   * localStorage does not exist on the server, so reading it during render
   * would produce one markup on the server and another in the browser. The
   * server snapshot says "hidden" so nothing is rendered until the client
   * knows the truth — which also means the panel fades in rather than
   * flashing away for someone who had dismissed it.
   *
   * An effect calling setState would work too, but React flags it: it costs
   * a second render pass on every page load for a value that never changes
   * after mount.
   */
  const dismissedBefore = useSyncExternalStore(
    // Nothing to subscribe to: storage is only written by this component.
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        // Private browsing, or storage disabled. Showing it is the safe
        // default: the customer has steps left either way.
        return false;
      }
    },
    () => true,
  );

  const dismissed = dismissedBefore || dismissedNow;

  function dismiss() {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do — it simply reappears on the next page.
    }
  }

  const remaining = steps.filter((step) => !step.done && !step.optional);
  const doneCount = steps.filter((step) => step.done).length;

  /** Nothing required left, or the customer hid it. */
  if (remaining.length === 0 || dismissed) return null;

  /*
    SHOWN ON /setup TOO.

    This used to return null there, reasoning that a floating copy of the list
    you are already reading is clutter. That was wrong in practice: /setup is
    exactly where someone goes to work through the steps, and they leave it
    the moment they start one — clicking "Connect your site" takes them to
    settings, where the panel is what carries the remaining steps with them.
    Hiding it on the page that sends them out meant the handover never
    happened, and the tracker only appeared if they happened to navigate
    somewhere else first.

    It is also the one page where a customer can see both at once and learn
    what the floating panel is for, which makes it less mysterious everywhere
    else.
  */

  const current = remaining[0];
  const currentIndex = steps.findIndex((step) => step.id === current.id);

  return (
    /*
      Sits above the chat launcher, which Crisp pins to the bottom of the
      viewport. The bottom offset clears it; hidden below `sm` because a panel
      this size on a phone covers the page it is meant to help with.
    */
    <div className="fixed right-4 bottom-24 z-30 hidden w-80 max-w-[calc(100vw-2rem)] sm:block">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <p className="min-w-0 flex-1 text-sm font-semibold">
            Set up &middot; Step {currentIndex + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Show steps" : "Hide steps"}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronDown
              className={`size-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide setup steps"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {collapsed ? null : (
          <>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto p-2">
              {steps.map((step) => {
                const isCurrent = step.id === current.id;

                return (
                  <li key={step.id}>
                    <Link
                      href={step.href}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                        isCurrent ? "font-medium" : ""
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                          step.done
                            ? "bg-emerald-500 text-white"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {step.done ? (
                          <Check className="size-3" />
                        ) : isCurrent ? (
                          currentIndex + 1
                        ) : (
                          <Lock className="size-2.5" />
                        )}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          step.done
                            ? "text-muted-foreground line-through decoration-muted-foreground/40"
                            : isCurrent
                              ? ""
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {doneCount} of {steps.length} done. This closes itself when the
                required steps are finished.
              </p>
              {/*
                The next action, not a link back to the checklist.

                This read "Open the full checklist" and pointed at /setup —
                useless on /setup itself, where the panel now also appears,
                and a detour everywhere else: someone who wants the list can
                click the sidebar. What they actually need is the step they
                are on, so the link is that step and it is named.
              */}
              <Link
                href={current.href}
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                {current.title} &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
