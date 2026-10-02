/**
 * Where to send someone after they sign in, and how to keep it while they
 * move between the sign-in and sign-up screens.
 *
 * Plain functions with no server imports: the auth form is a client
 * component and reads both.
 */

/** Where a sign-in lands when nothing better was asked for. */
export const CALLBACK_URL = "/dashboard";

/**
 * True when the value holds a control character, including tab, CR and LF.
 *
 * Browsers delete tabs and newlines from a URL before parsing it, so
 * "/<TAB>/evil.com" passes a "starts with a single slash" test as written and
 * then navigates as "//evil.com" - another site. No path we ever put in ?next=
 * contains one, so any of them means the value was crafted.
 *
 * A character-code loop rather than a regex with control characters in it,
 * which linters flag as a likely mistake.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Where to go after signing in, from ?next=.
 *
 * AN OPEN-REDIRECT GUARD, not a convenience. Whatever lands here is put
 * straight into a navigation the moment a session exists, so an unchecked
 * value turns our own sign-in page into a redirector to anywhere - the
 * classic phishing setup, where the victim really did sign in to RepGet and
 * really was then handed to somebody else's site.
 *
 * Only a path on this origin is allowed:
 *  - must start with a single "/"
 *  - "//evil.com" is rejected: browsers read it as a protocol-relative URL
 *  - a backslash is rejected too, since some clients normalise "/\" to "//"
 *  - a control character is rejected, since browsers strip tabs and newlines
 *    and "/\t/evil.com" would otherwise become "//evil.com" (see above)
 *
 * Anything else falls back to the dashboard rather than erroring. A bad
 * `next` is not the customer's problem to solve; they came here to sign in.
 */
export function safeNext(value: string | null): string {
  if (!value) return CALLBACK_URL;
  if (!value.startsWith("/")) return CALLBACK_URL;
  if (value.startsWith("//") || value.startsWith("/\\")) return CALLBACK_URL;
  if (hasControlChar(value)) return CALLBACK_URL;
  return value;
}

/**
 * The link from sign-in to sign-up (or back) that keeps where the person was
 * going and the address they were invited at.
 *
 * WHY. The switch link was a bare "/sign-up", so an invitee who arrived at
 * sign-in from an invitation email, had no account yet and pressed "Sign up"
 * lost ?next=/invite/<token> on the way. They signed up, landed on
 * onboarding, and the invitation was never accepted - what happened in
 * production.
 *
 * `next` is carried only when it is a value safeNext would pass UNCHANGED and
 * not the default. A rejected value is dropped rather than replaced with the
 * dashboard, so the link never repeats a crafted redirect, and the default is
 * left out because the other screen falls back to it anyway.
 *
 * `email` pre-fills the other form; only a non-empty value is kept.
 */
export function authSwitchHref(
  target: "/sign-in" | "/sign-up",
  rawNext: string | null,
  email: string,
): string {
  const params = new URLSearchParams();

  if (rawNext && rawNext !== CALLBACK_URL && safeNext(rawNext) === rawNext) {
    params.set("next", rawNext);
  }

  const cleanEmail = email.trim();
  if (cleanEmail) params.set("email", cleanEmail);

  const query = params.toString();
  return query ? `${target}?${query}` : target;
}
