import { describeMiss, missLogLine } from "@/lib/not-found-log";

/**
 * Where the 404 page reports a missed address (lib/not-found-log.ts). Always
 * answers 204 and never says why a report was ignored: there is nothing for a
 * caller to learn here.
 *
 * Only reports a browser sent from one of this site's own pages are logged
 * (Sec-Fetch-Site: same-origin, which a page elsewhere cannot set), so other
 * sites cannot write into our logs through their visitors' browsers.
 */
export const dynamic = "force-dynamic";

const NOTHING = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") !== "same-origin") return NOTHING();
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return NOTHING();

  const text = await request.text().catch(() => "");
  if (text.length > 4096) return NOTHING();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NOTHING();
  }

  /*
    This site's address as the visitor used it - the Host header - not the
    server's own view of request.url, which behind `next start` or a proxy can
    name localhost and made every internal link look external.
  */
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const report = describeMiss(body, host ? `${url.protocol}//${host}` : url.origin);
  if (report) console.warn(missLogLine(report));
  return NOTHING();
}
