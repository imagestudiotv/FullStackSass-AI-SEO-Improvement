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
  try {
    return await requestOnce(url, headers, timeoutMs, signal);
  } catch (error) {
    // An abort is the caller's own deadline; retrying would ignore it.
    if (signal.aborted) throw error;

    return await fetch(url, { signal, redirect: "manual", headers });
  }
}
