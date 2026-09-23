"use client";

import { Check, ChevronDown, ChevronUp, Lock, X } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
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
 * It disappears on its own once the required steps are done, so there is
 * nothing to dismiss permanently — and the X reflects that: it hides the
 * panel for the current tab, not for the browser. See STORAGE_KEY.
 */

/**
 * Remembers a dismissal for THIS TAB ONLY.
 *
 * sessionStorage, not localStorage. It was localStorage, which meant one
 * click of the X hid the panel in that browser permanently — for the whole of
 * setup, on every page, with no way back short of clearing site data. The
 * customer could not have known that was the bargain: an X on a floating
 * panel reads as "not now", not "never again".
 *
 * That also contradicted the point of the feature. The client asked for it
 * because setup guidance should follow the customer around — "it will still
 * continue to appear thoose setup steps is missing to complete the
 * integration and activation" — and a permanent hide is the one outcome that
 * cannot satisfy.
 *
 * THE KEY IS ALSO RENAMED, deliberately. Anyone who clicked the X while it
 * was permanent is still carrying `repget:setup-tracker-dismissed = "1"` in
 * localStorage, and that value would otherwise keep hiding the panel forever
 * under the new logic too. A new key means those browsers start fresh; the
 * cleanup below removes the stale one so it is not left lying there.
 */
const STORAGE_KEY = "repget:setup-tracker-hidden";

/** The permanent key this replaced, cleared on sight. */
const LEGACY_KEY = "repget:setup-tracker-dismissed";

/**
 * Fired by this component after it writes to sessionStorage.
 *
 * The browser's own `storage` event only fires in OTHER tabs, never the one
 * that wrote — so it cannot tell this component about its own change, which
 * is exactly what the badge needs to know about.
 */
const STORAGE_EVENT = "repget:setup-tracker-changed";

export function SetupTracker({
  steps,
  t = getMessages("en").app.common,
}: {
  steps: LaunchStep[];
  /** Shared words, defaulting to English. */
  t?: Messages["app"]["common"];
}) {
  const [collapsed, setCollapsed] = useState(false);
  /** Set by the dismiss button, separate from what storage remembers. */
  const [dismissedNow, setDismissedNow] = useState(false);

  /**
   * Whether this browser hid the panel before, read through
   * useSyncExternalStore rather than an effect.
   *
   * localStorage does not exist on the server, so reading it during render
   * would produce one markup on the server and another in the browser.
   *
   * The server snapshot says SHOWN, so the panel is in the HTML and the
   * common case — nobody has hidden it — needs no client round-trip at all.
   * Someone who hid it in this tab sees it removed on hydration instead. That
   * trade is deliberate: a brief flash for the few who opted out beats an
   * invisible panel for everyone who did not, which is what the opposite
   * default produced.
   *
   * An effect calling setState would work too, but React flags it: it costs
   * a second render pass on every page load for a value that never changes
   * after mount.
   */
  const dismissedBefore = useSyncExternalStore(
    /**
     * Storage IS only written by this component — but it is still written,
     * and without a subscription React never re-reads the snapshot.
     *
     * That is what broke the badge. Clicking it called restore(), which
     * cleared the key and set dismissedNow to false, but `dismissed` is
     * `dismissedBefore || dismissedNow` and dismissedBefore was still the
     * `true` captured when the panel was hidden. The badge re-rendered as a
     * badge, so the one control that exists to bring the panel back did
     * nothing at all — the trap the comment below says was already fixed
     * once, reintroduced by the caching.
     *
     * Subscribing to a local event makes the snapshot re-read whenever this
     * component writes, so restore() takes effect on the click.
     */
    (onStoreChange) => {
      window.addEventListener(STORAGE_EVENT, onStoreChange);
      return () => window.removeEventListener(STORAGE_EVENT, onStoreChange);
    },
    () => {
      try {
        /*
          Clear the old permanent flag whenever it is seen. Reading is the
          only moment we are guaranteed to run in a browser that has one.
        */
        window.localStorage.removeItem(LEGACY_KEY);
        return window.sessionStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        // Private browsing, or storage disabled. Showing it is the safe
        // default: the customer has steps left either way.
        return false;
      }
    },
    /*
      SERVER SNAPSHOT: false, not true.

      This said `true` — "assume dismissed" — so the server rendered nothing
      and the panel could only appear after hydration re-read localStorage.
      That made the common case (never dismissed, which is everyone by
      default) depend on a client round-trip to show a panel the server
      already had all the data for, and made every failure in that round-trip
      look identical to "you dismissed it".

      `false` means the server renders the panel, which is correct for anyone
      who has not hidden it. Someone who HAS dismissed it now sees it removed
      on hydration rather than never drawn — a brief flash for the minority
      who opted out, instead of an invisible panel for the majority who did
      not.
    */
    () => false,
  );

  const dismissed = dismissedBefore || dismissedNow;

  function dismiss() {
    setDismissedNow(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      // Nothing to do — it simply reappears on the next page.
    }
  }

  /** Puts the panel back from the collapsed badge. */
  function restore() {
    setDismissedNow(false);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
      // Tells the snapshot above to re-read; without it the cached `true`
      // keeps the panel hidden and this click does nothing.
      window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch {
      /*
        Storage refused the write. The panel still reopens for this render
        because dismissedNow is state; it simply will not be remembered,
        which is the harmless direction to fail in.
      */
    }
  }

  const remaining = steps.filter((step) => !step.done && !step.optional);
  const doneCount = steps.filter((step) => step.done).length;

  /**
   * Nothing required left: gone for good, and rightly so.
   *
   * This is the ONLY case that renders nothing. Being hidden by the customer
   * is handled below as a collapsed icon, not an absence.
   */
  if (remaining.length === 0) return null;

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

  /**
   * HIDDEN COLLAPSES TO AN ICON. It does not disappear.
   *
   * The client: "If I hide the bar box from right there is no way to restore
   * it… I think it should stay as a icon and when you click it's showing
   * back. This is useful until we set all points and after that it will never
   * showing."
   *
   * Exactly right, and the previous behaviour was a trap: the X returned null
   * and the only way back was a new tab, which nothing on screen told you.
   * Somebody who hid it once to read the page underneath had silently thrown
   * away their setup guidance for the rest of the session.
   *
   * The badge carries the progress count, so it is still doing the panel's
   * job while collapsed — "3/9 left" is a reason to click it. And the
   * disappearing case the client describes is already handled above: once no
   * required steps remain, the whole component renders nothing and never
   * comes back, badge included.
   */
  if (dismissed) {
    return (
      <div className="fixed right-4 bottom-28 z-[999999] hidden sm:block">
        <button
          type="button"
          onClick={restore}
          aria-label={`Show setup steps - ${remaining.length} left`}
          className="flex items-center gap-2 rounded-full border bg-card py-2 pr-4 pl-2.5 shadow-lg transition-colors hover:bg-accent"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {remaining.length}
          </span>
          <span className="text-sm font-medium">{t.setUp}</span>
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    /*
      Sits above the chat launcher, which Crisp pins to the bottom of the
      viewport. Hidden below `sm` because a panel this size on a phone covers
      the page it is meant to help with.

      z-[999999], not z-30. Crisp injects its widget with a z-index in the
      millions, and our own scale tops out at 50 — so at z-30 this panel was
      painted underneath a third-party element we do not control the stacking
      of. A tall value is the wrong instinct almost everywhere, and correct
      here for exactly one reason: the thing being escaped is not ours to
      renumber.

      bottom-28 rather than bottom-24: Crisp's launcher occupies the band 14px
      to 68px from the bottom, and 96px left only a 28px gap that its hover
      halo still reached into.
    */
    <div className="fixed right-4 bottom-28 z-[999999] hidden w-80 max-w-[calc(100vw-2rem)] sm:block">
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
            aria-label={t.hideSetupSteps}
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
