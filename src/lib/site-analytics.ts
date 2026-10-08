/**
 * What a page view tells Vercel Web Analytics about the address it was on.
 *
 * The owner chose Vercel Web Analytics for visit statistics: no cookies, so
 * no consent banner. (Google Analytics, which does need one, asks first and
 * cleans its addresses with this same function: lib/google-analytics.ts.)
 * Vercel's script reports a page as `location.href`, query string and
 * fragment included, and some of our addresses carry things that must never
 * leave the browser:
 *
 *  - /invite/<token>: the token is a bearer credential. Whoever holds it
 *    becomes an editor on a customer's website (lib/websites/
 *    invitation-token.ts).
 *  - Query strings: ?request= on /connect/wordpress (the plugin's pending
 *    connection), ?email= on sign-in and sign-up, the ?token= and
 *    ?subscription_id= PayPal appends when it sends a payer back.
 *  - Fragments: the one part of an address a browser never sends to a
 *    server, which is why secrets get put there - the plugin key travels to
 *    WordPress as #repget_key=. A script that copies location.href into a
 *    request would undo that wherever such a fragment appears.
 *
 * So the rule is the opposite of a deny-list of parameters: NO query string
 * and NO fragment, ever. A deny-list is only as good as the last parameter
 * someone remembered to add to it, and the statistics lose nothing that
 * matters - pages are counted by path.
 *
 * NO IMPORTS: this runs in every visitor's browser, and is tested as a plain
 * function.
 */

/**
 * Path prefixes whose next segment is a secret, and what replaces it. The
 * placeholder is the route's own folder name, so the statistics read like
 * the app's routes (/invite/[token]).
 *
 * /r/<code> is a referral link. A route handler answers it with a redirect,
 * so no page view is recorded there today; it is listed because a referral
 * code names the person who shared it, and that should not rest on the
 * redirect staying.
 */
const SECRET_SEGMENT: Record<string, string> = {
  invite: "[token]",
  r: "[code]",
};

/**
 * Prefixes whose page views are not sent at all.
 *
 *  - /admin: the owner's own console. Staff visits are not site traffic, and
 *    its addresses point at customers' records.
 *  - /api: never a page, so never a page view. Listed because the addresses
 *    carrying the most dangerous values - email verification links, the
 *    OAuth callbacks with their ?code= - live there, and a browser does pass
 *    through them.
 */
const NOT_COUNTED = new Set(["admin", "api"]);

/**
 * Record ids (websites, articles, organisations) are UUIDs. Not secrets -
 * every page behind one checks who is asking - but each names one
 * customer's workspace, and a count for "/websites/<that one>" is nothing
 * the owner needs. The Next component reports the route pattern
 * (/websites/[websiteId]) beside the address anyway.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The address to report for a page, or null to report nothing.
 *
 * Fails closed: anything this cannot parse is dropped rather than passed on
 * as it came, because "could not read it" says nothing about what it holds.
 */
export function analyticsUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const segments = url.pathname.split("/").filter((s) => s !== "");

  /*
    The prefix is compared decoded and lower-cased, so /%61dmin and /Admin
    count as /admin. Neither reaches the admin pages, but dropping them costs
    nothing, and the alternative is reasoning about how every layer between
    here and the router normalises a path. A segment that will not decode is
    not a page anyone was sent to.
  */
  let prefix: string;
  try {
    prefix = decodeURIComponent(segments[0] ?? "").toLowerCase();
  } catch {
    return null;
  }
  if (NOT_COUNTED.has(prefix)) return null;

  const placeholder = SECRET_SEGMENT[prefix];
  if (placeholder && segments.length > 1) {
    /*
      Anything deeper than /invite/<token> is not a page: it is a 404.
      Dropped rather than cleaned, because the Next component sends a second
      copy of the path that this function never sees - the route pattern,
      worked out from whichever route answered. A real invitation reports
      /invite/[token]; this 404 is answered today by [locale]/[...rest] and
      reports that (checked in a browser, 2026-10-05). But a route with no
      parameters reports the raw path, token included, so which route
      catches a mistyped link must not be what keeps the token private.
    */
    if (segments.length > 2) return null;
    segments[1] = placeholder;
  }

  url.pathname = "/" + segments.map((s) => (UUID.test(s) ? "[id]" : s)).join("/");
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.href;
}

/**
 * The `beforeSend` hook for @vercel/analytics: the same event with its
 * address cleaned, or null to drop it.
 *
 * Copies the event rather than building a new one: the script attaches
 * fields beyond the documented { type, url } and reads them back from what
 * this returns.
 */
export function analyticsBeforeSend<E extends { url: string }>(event: E): E | null {
  const url = analyticsUrl(event.url);
  return url === null ? null : { ...event, url };
}
