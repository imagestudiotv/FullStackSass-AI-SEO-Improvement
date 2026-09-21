import { checkLimit } from "@/lib/usage";

/**
 * Whether a website may spend money, for use inside a server action.
 *
 * SEPARATE FROM requirePlan(), which redirects and therefore only makes sense
 * in a page. An action returns { ok: false, error } to a form that is already
 * on screen; throwing a redirect from one produces a confusing navigation in
 * the middle of a submit, and callers that catch errors would swallow it.
 *
 * WHY BOTH EXIST: the pages are now gated, but a server action is a public
 * HTTP endpoint. Next gives every action a URL, and anything the browser can
 * invoke, a script can invoke — a cancelled customer whose page redirects can
 * still POST to the action behind it. The page guard stops people wandering
 * in; this stops the spend.
 *
 * Deliberately NOT a limit check. Running out of this month's articles is a
 * different answer with a different message, and usage.ts already handles it
 * where it applies. This asks only the entitlement question: is there a live
 * subscription paying for this website at all.
 */
export async function isEntitledToSpend(
  websiteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = await checkLimit(websiteId, "keywords");

  if (limit.reason === "no_active_plan") {
    return {
      ok: false,
      error: "Choose a plan for this website first",
    };
  }

  if (limit.reason === "subscription_inactive") {
    return {
      ok: false,
      error: "This website's subscription is not active. Update billing to continue.",
    };
  }

  return { ok: true };
}
