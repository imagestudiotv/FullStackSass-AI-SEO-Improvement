"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { loadCrispScript, pushToCrisp } from "@/components/live-chat";
import { claimOnboardingWelcomeAction } from "@/lib/support/actions";

/**
 * The onboarding welcome in the live chat (ticket 2026-11-19, item 6, "RepGet -
 * Proactive Human Support During Onboarding"). Rendered by the app layout
 * only for someone the server already found eligible
 * (lib/support/onboarding-welcome.ts); everything is checked again when the
 * welcome is claimed.
 *
 * What it does, in the spec's order:
 *
 *  1. Only on the dashboard, and only after WAIT_MS there without setup
 *     progress. Leaving the dashboard cancels the wait; coming back starts
 *     it again. Typing in a form starts it again too - "if the user is
 *     actively completing setup steps, postpone the message".
 *  2. Then it asks Crisp (once loaded) whether an operator is available.
 *     When nobody is, it does NOTHING - no claim, no event - and tries again
 *     when Crisp says someone came online: the greeting is postponed "until
 *     coverage resumes", the truthful option of the spec. The same when a
 *     conversation is already ongoing in this browser, or the chat is open.
 *  3. It asks the server to CLAIM the welcome. The claim compares the setup
 *     steps done now with those done when the wait began; any progress
 *     returns "progressed" and the wait starts over. The claim is atomic, so
 *     one tab or device in the whole account wins.
 *  4. Only the winner pushes the custom event repget_onboarding_help_eligible.
 *     Crisp's Message Trigger repget_onboarding_human_help (owner's setup)
 *     shows the approved message, as a message preview by the launcher - this
 *     code never opens the chat window.
 */

const WAIT_MS = 60_000;
/** How long to wait for Crisp's script and session before trying later. */
const CRISP_READY_MS = 20_000;
export const WELCOME_EVENT = "repget_onboarding_help_eligible";

type LoadedCrisp = { is: (key: string) => boolean; get: (key: string) => unknown };

/** Crisp, once its script and this visitor's session are loaded; null if not within CRISP_READY_MS. */
function crispReady(): Promise<LoadedCrisp | null> {
  loadCrispScript();
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const crisp = window.$crisp;
      if (crisp && typeof crisp.is === "function" && typeof crisp.get === "function") {
        let session: unknown = null;
        try {
          session = crisp.get("session:identifier");
        } catch {
          // Not loaded yet.
        }
        if (session) return resolve(crisp as LoadedCrisp);
      }
      if (Date.now() - started > CRISP_READY_MS) return resolve(null);
      window.setTimeout(check, 500);
    };
    check();
  });
}

/** Crisp's synchronous `is`, which throws on a key it does not know; unknown counts as false. */
function crispIs(crisp: LoadedCrisp, key: string): boolean {
  try {
    return crisp.is(key) === true;
  } catch {
    return false;
  }
}

export function CrispOnboarding({ websiteId, baselineDone }: { websiteId: string; baselineDone: number }) {
  const pathname = usePathname();
  /** The setup steps done when the current wait began; raised when the server reports progress. */
  const baseline = useRef(baselineDone);
  /** Set once the welcome was sent or refused for good; nothing more happens on this page. */
  const finished = useRef(false);
  const onDashboard = pathname === "/dashboard";

  useEffect(() => {
    const websiteIdOk = Boolean(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim());
    if (!websiteIdOk || !onDashboard || finished.current) return;
    let timer: number | undefined;
    let cancelled = false;
    let waitingForOperator = false;

    const restart = () => {
      window.clearTimeout(timer);
      if (!cancelled && !finished.current) timer = window.setTimeout(attempt, WAIT_MS);
    };

    // Typing or choosing in a form on the page: they are working, wait again.
    const onInput = (event: Event) => {
      if (event.isTrusted && !waitingForOperator) restart();
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);

    async function attempt() {
      if (cancelled || finished.current) return;
      // A tab in the background is not someone stuck on the dashboard.
      if (document.visibilityState !== "visible") return restart();
      const crisp = await crispReady();
      if (cancelled || finished.current) return;
      if (!crisp) return restart();
      // They are already talking to us, or reading the chat: no welcome over it.
      if (crispIs(crisp, "session:ongoing")) {
        finished.current = true;
        return;
      }
      if (crispIs(crisp, "chat:opened")) return restart();
      if (!crispIs(crisp, "website:available")) {
        // Nobody online: postpone, and try again the moment someone is.
        waitingForOperator = true;
        pushToCrisp([
          "on",
          "website:availability:changed",
          (available: unknown) => {
            if (available !== true || cancelled || finished.current) return;
            waitingForOperator = false;
            pushToCrisp(["off", "website:availability:changed"]);
            void attempt();
          },
        ]);
        return;
      }
      const result = await claimOnboardingWelcomeAction({ websiteId, baselineDone: baseline.current });
      if (cancelled) return;
      if (result.ok) {
        finished.current = true;
        pushToCrisp(["set", "session:event", [[[WELCOME_EVENT, { website_id: websiteId }, "orange"]]]]);
        return;
      }
      if (result.reason === "progressed") {
        baseline.current = result.done ?? baseline.current + 1;
        return restart();
      }
      // A network or server hiccup: try again after another wait. Anything else is final.
      if (result.reason === "error") return restart();
      finished.current = true;
    }

    restart();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      if (waitingForOperator) pushToCrisp(["off", "website:availability:changed"]);
    };
  }, [onDashboard, websiteId]);

  return null;
}
