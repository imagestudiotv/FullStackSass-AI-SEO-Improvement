import { cookies } from "next/headers";

/**
 * Which website the customer is currently looking at.
 *
 * The sidebar shows a website's sections — health, articles, publishing and so
 * on — and needs to know which website before the page renders. Reading it
 * from the URL works on /websites/<id>/... but not on the dashboard, which
 * carries the site in a query parameter, or on Billing, which carries it
 * nowhere. Without a shared answer the sections vanished the moment you left
 * a website page, even though the switcher still named a site.
 *
 * A cookie rather than client state, because the sidebar is rendered on the
 * server. State held in the browser would arrive after the first paint and
 * the menu would visibly appear a moment late on every navigation.
 *
 * Not a credential. The worst a forged value can do is select a website the
 * customer cannot see, and every page they reach through it re-checks
 * ownership through requireWebsite — a bad id is a 404, not a leak.
 */

const COOKIE_NAME = "site";

/** A year. The choice is a preference, and re-picking it is annoying. */
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Website ids are UUIDs; anything else did not come from us. */
const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The remembered website id, or null when there is no usable one. */
export async function readSelectedWebsite(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value && ID_RE.test(value) ? value : null;
}

/** Remembers a website as the current one. */
export async function writeSelectedWebsite(websiteId: string): Promise<void> {
  if (!ID_RE.test(websiteId)) return;

  (await cookies()).set(COOKIE_NAME, websiteId, {
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
  });
}

/**
 * Picks the website to show the sections for.
 *
 * The URL wins when it names one: someone on /websites/abc/publishing is
 * looking at abc, whatever they last chose in the switcher. The cookie is the
 * fallback, and the first website is the fallback to that — the same default
 * the dashboard uses, so the two never disagree about which site is "current".
 */
export function resolveWebsiteId(
  fromPath: string | null,
  remembered: string | null,
  owned: string[],
): string | null {
  if (fromPath && owned.includes(fromPath)) return fromPath;
  if (remembered && owned.includes(remembered)) return remembered;
  return owned[0] ?? null;
}
