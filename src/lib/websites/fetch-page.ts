import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

/**
 * Fetches a customer's page over Node's classic TLS stack rather than `fetch`.
 *
 * WHY THIS FILE EXISTS: Cloudflare blocks undici — the HTTP client behind
 * Node's global `fetch` — by TLS fingerprint, before the request ever reaches
 * the origin. It is not the User-Agent, not rate limiting, and not the site
 * being down. Measured from one machine, one IP, within the same second:
 *
 *   imagestudio.com   undici 403      node:https 200 (446,970 bytes)
 *   vercel.com        undici 200      node:https 200
 *   wordpress.org     undici 200      node:https 200
 *   stripe.com        undici 200      node:https 200
 *
 * Only the Cloudflare-protected site refuses undici, and it refuses it every
 * time: twelve trials per header variant, all 403, including variants that had
 * appeared to work in a smaller sample. Changing `accept-language`, sending a
 * browser User-Agent, or dropping headers entirely makes no difference — the
 * block happens at the TLS handshake, above the HTTP layer.
 *
 * The cost of getting this wrong was total: onboarding step one failed with
 * "The site returned 403" on a site that every browser and curl loaded fine,
 * which left websites.status = 'failed' with no profile, and every later step
 * starved. Keyword research then found no profile, wrote zero rows and
 * reported success, so the content screen span forever on a job that had
 * already finished with nothing.
 *
 * node:https uses OpenSSL's default cipher ordering, which matches the common
 * browser/curl profile Cloudflare permits. No new dependency, and the transport
 * is the only thing that changes: redirects, timeouts and byte caps stay with
 * the caller.
 */

/** Response headers we surface. Node lowercases these for us. */
type Headers_ = Record<string, string | string[] | undefined>;

/**
 * The header set a current Chrome actually sends for a top-level navigation.
 *
 * Used only on the retry in fetchPage, never as the first attempt. Every value
 * is a real one Chrome emits — the point is to make a legitimate request that
 * bot-scoring engines recognise as complete, not to impersonate a specific
 * person or evade a deliberate block.
 *
 * Keep them together and keep them consistent: a UA claiming Chrome 131 beside
 * sec-ch-ua saying something else is exactly the mismatch these systems look
 * for, and a half-set scores worse than our own honest crawler.
 */
const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9," +
    "image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,*;q=0.5",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/**
 * Performs ONE request and adapts it to a standard `Response`.
 *
 * Returning a real `Response` is deliberate: the caller already reads
 * `.status`, `.headers.get()` and `.body.getReader()`, and a bespoke shape
 * would push this file's existence into code that should not care which
 * transport was used.
 *
 * `redirect: manual` semantics are preserved by simply not following anything
 * — Node does not redirect on its own. The caller re-validates every hop
 * against its own allow-list, which is what stops an open redirect on a
 * customer's site walking us onto a private address.
 */
function requestOnce(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      { method: "GET", headers, signal },
      (res) => {
        const status = res.statusCode ?? 0;
        const raw = res.headers as Headers_;

        const out = new Headers();
        for (const [key, value] of Object.entries(raw)) {
          if (value === undefined) continue;
          // set-cookie arrives as an array; everything else is a string.
          if (Array.isArray(value)) for (const v of value) out.append(key, v);
          else out.set(key, value);
        }

        /*
          A 204/304 must not carry a body, and constructing a Response with
          one for those statuses throws. Redirects are bodyless in practice
          and we only want their Location header.
        */
        const bodyless = status === 204 || status === 304;
        if (bodyless) {
          res.resume();
          resolve(new Response(null, { status, headers: out }));
          return;
        }

        /**
         * The body stream needs its OWN error handler, or an abort mid-download
         * hangs the caller forever.
         *
         * This promise has already resolved by the time the body streams, so a
         * later error cannot reject it — it lands on `res` instead. Without a
         * listener there, Node raises it as an unhandled 'error' event and the
         * web stream that readCapped is awaiting simply never settles: no
         * chunk, no `done`, no throw. The request looks alive, the screen
         * spins, and nothing times out because the socket did receive data.
         *
         * babylovegrowth.ai is the case that showed this up. Its homepage is
         * 1.56 MB behind two redirects, so the body takes seconds to arrive —
         * a wide enough window for the caller's deadline to land in the middle
         * of the download rather than before it, which is when this path is
         * taken. Destroying the stream converts the dangling read into a
         * rejection the caller can actually see.
         */
        res.on("error", (error) => {
          res.destroy();
          // Surfaces through readCapped's pending read() as a rejection.
          void error;
        });

        resolve(
          new Response(Readable.toWeb(res) as ReadableStream, {
            status,
            headers: out,
          }),
        );
      },
    );

    /*
      Node's socket timeout fires on inactivity, not total duration, so the
      caller's AbortSignal remains the real deadline. This only stops a
      connection that opens and then says nothing at all.
    */
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetches a page, preferring node:https and falling back to global fetch.
 *
 * THE FALLBACK IS NOT REDUNDANT. node:https speaks only HTTP/1.1, and while
 * every server in use today still offers it, a host that one day serves
 * HTTP/2 exclusively would fail here and succeed on undici. The two clients
 * fail in different circumstances, so trying both is strictly better than
 * either alone — and this function is on the path of the very first screen a
 * customer sees, where a failure costs the whole signup.
 *
 * Only a TRANSPORT failure falls through. An HTTP response of any status —
 * including the 403 this file exists to avoid — is returned as-is, because
 * the caller distinguishes those and a retry would not change the answer.
 */
export async function fetchPage(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await requestOnce(url, headers, timeoutMs, signal);
  } catch (error) {
    // An abort is the caller's own deadline; retrying would ignore it.
    if (signal.aborted) throw error;

    response = await fetch(url, { signal, redirect: "manual", headers });
  }

  /**
   * A refusal gets ONE second attempt with a full browser header set.
   *
   * Some sites run bot management that scores the request as a whole rather
   * than reading the User-Agent: hermes.com (DataDome) and rolex.com (Akamai)
   * answer 403 to our identified crawler, to a bare Chrome User-Agent, and to
   * curl alike — but return the real page to a request carrying the complete
   * set of headers Chrome actually sends. No single header flips it; the full
   * set does.
   *
   * WHY THIS IS NOT THE DEFAULT, and why the two sets cannot be merged: they
   * are mutually exclusive in practice. Measured five times each, same second,
   * same IP:
   *
   *   imagestudio.com   identified crawler 200,200,200,200,200
   *                     browser headers    403,403,403,403,403
   *   hermes.com        identified crawler 403
   *                     browser headers    200
   *
   * So a site that welcomes a declared bot can refuse one that looks like a
   * browser, and vice versa. Leading with our own User-Agent keeps us honest
   * with everyone who reads it — including anyone who has allowlisted us — and
   * the fallback only runs where that was already refused, which is a request
   * that would otherwise have failed outright.
   *
   * THIS IS NOT EVASION. The identified crawler is tried first every time, the
   * second attempt sends real Chrome headers rather than forged ones, and no
   * CAPTCHA is solved, no cookie replayed and no IP rotated — a site that
   * actually blocks by IP or challenges with JavaScript still refuses us, as
   * it should. A site that wants no crawlers at all says so in robots.txt.
   */
  if (
    response.status === 403 ||
    response.status === 401 ||
    response.status === 451
  ) {
    try {
      const retried = await requestOnce(
        url,
        { ...headers, ...BROWSER_HEADERS },
        timeoutMs,
        signal,
      );
      // Only take the retry if it actually did better.
      if (retried.status < 400) return retried;
    } catch {
      // Keep the original refusal; the retry is a bonus, not a requirement.
    }
  }

  return response;
}
